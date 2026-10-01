/** A Slack conversation reference parsed from a permalink. */
export interface SlackRef {
  url: string;
  host?: string; // e.g. acme.slack.com (absent for app.slack.com / slack:// links)
  teamId?: string;
  channelId: string;
  ts?: string; // message ts, "1790663425.161349"
  threadTs?: string;
}

const ARCHIVES =
  /https:\/\/([a-z0-9-]+\.(?:enterprise\.)?slack\.com)\/archives\/([CDG][A-Z0-9]+)(?:\/p(\d{10})(\d{6}))?(\?[^\s>)\]]*)?/i;
const APP_CLIENT =
  /https:\/\/app\.slack\.com\/client\/(T[A-Z0-9]+)\/([CDG][A-Z0-9]+)(?:\/thread\/[CDG][A-Z0-9]+-(\d{10}\.\d{6}))?/i;
const DEEP_LINK = /slack:\/\/channel\?([^\s>)\]]+)/i;

/** First Slack conversation link in `text`, or null. File/canvas links are not conversations. */
export function parseSlackUrl(text: string): SlackRef | null {
  const a = ARCHIVES.exec(text);
  if (a) {
    const [url, host, channelId, secs, micros, query] = a;
    const params = new URLSearchParams(query ?? "");
    const ts = secs ? `${secs}.${micros}` : undefined;
    return {
      url: url.replace(/[.,;:!?]+$/, ""),
      host: host.toLowerCase(),
      channelId: (params.get("cid") ?? channelId).toUpperCase(),
      ts,
      threadTs: params.get("thread_ts") ?? ts,
    };
  }
  const c = APP_CLIENT.exec(text);
  if (c) {
    const [url, teamId, channelId, threadTs] = c;
    return { url, teamId, channelId: channelId.toUpperCase(), threadTs };
  }
  const d = DEEP_LINK.exec(text);
  if (d) {
    const params = new URLSearchParams(d[1]);
    const id = params.get("id");
    if (id && /^[CDG][A-Z0-9]+$/i.test(id))
      return { url: d[0], teamId: params.get("team") ?? undefined, channelId: id.toUpperCase() };
  }
  return null;
}

/** Session identity: one Claude session per Slack conversation. */
export function slackKey(ref: SlackRef): string {
  return `${ref.host ?? ref.teamId ?? "slack"}:${ref.channelId}`;
}

const COMMAND = /^:([a-z0-9][a-z0-9_-]*)$/i;

export interface Flags {
  prompt: string; // prompt with the leading commands removed
  fresh: boolean; // `:new`: start a new session even if one could be resumed
  target?: string; // `:<query>`: send to the existing agent the picker ranks first
}

/** Leading `:word` commands, any order: `:new`, else the first other word is the agent query. */
export function parseFlags(prompt: string): Flags {
  const tokens = prompt.trim().split(/\s+/);
  let fresh = false;
  let target: string | undefined;
  let i = 0;
  for (; i < tokens.length; i++) {
    const m = COMMAND.exec(tokens[i]);
    if (!m) break;
    const word = m[1].toLowerCase();
    if (word === "new") fresh = true;
    else if (!target) target = word;
  }
  if (i === 0) return { prompt, fresh, target };
  return { prompt: stripLeading(prompt, i), fresh, target };
}

/** Removes the first `n` whitespace-separated tokens, keeping the rest of the prompt verbatim. */
function stripLeading(prompt: string, n: number): string {
  let rest = prompt.trimStart();
  for (let k = 0; k < n; k++) rest = rest.replace(/^\S+\s*/, "");
  return rest;
}

/**
 * The live clipboard's copy time is unknown: it was copied after the previous launch
 * and, to be eligible at all, within the freshness window.
 */
export function liveClipCopiedAt(lastLaunchAt: number | null, now: number): number {
  return Math.max(lastLaunchAt ?? 0, now - CLIP_MAX_AGE_MS);
}

/** A clipboard entry: the live clipboard, or a Slack link recorded by clip-watch. */
export interface ClipCandidate {
  text: string;
  changeCount: number; // NSPasteboard change count when it was copied
  at: number; // epoch ms
}

export const CLIP_MAX_AGE_MS = 10 * 60 * 1000;

export interface PickInput {
  prompt: string;
  clips: ClipCandidate[];
  lastLaunchCount: number | null; // change count at the previous Raycast launch
  currentCount: number;
  now: number;
  isScheduled: boolean;
  /** True when the link already appears in an agent session since it was copied. */
  alreadyPasted?: (url: string, copiedAt: number) => boolean;
}

export interface Picked {
  ref: SlackRef | null;
  fromClipboard: boolean;
  fresh: boolean;
  target?: string;
  prompt: string; // prompt with leading commands removed
}

/**
 * A link in the prompt wins. Otherwise the newest clipboard entry that is exactly
 * one Slack link, copied since the last launch and within the last 10 minutes, so
 * later copies (e.g. dictation) don't hide it and an old copy can't hijack an
 * unrelated prompt.
 */
export function pickSlackRef(input: PickInput): Picked {
  const { prompt, fresh, target } = parseFlags(input.prompt);
  const none = { ref: null, fromClipboard: false, fresh, target, prompt };
  // `:<agent>` sends the prompt as typed: no Slack binding, typed or copied.
  if (input.isScheduled || target) return none;

  const inPrompt = parseSlackUrl(prompt);
  if (inPrompt) return { ref: inPrompt, fromClipboard: false, fresh, target, prompt };

  // The counter restarts at boot; a lower current count means the last launch predates it.
  const since =
    input.lastLaunchCount === null || input.currentCount < input.lastLaunchCount
      ? -1
      : input.lastLaunchCount;
  const eligible = input.clips
    .filter((c) => c.changeCount > since && input.now - c.at <= CLIP_MAX_AGE_MS)
    .sort((a, b) => b.changeCount - a.changeCount);
  for (const c of eligible) {
    const text = c.text.trim();
    if (/\s/.test(text)) continue;
    const ref = parseSlackUrl(text);
    if (ref && ref.url === text && !input.alreadyPasted?.(ref.url, c.at))
      return { ref, fromClipboard: true, fresh, target, prompt };
  }
  return none;
}

/** Prefixes the prompt so the session reads the conversation through the right Slack MCP server. */
export function withSlackContext(prompt: string, ref: SlackRef, mcpServer?: string): string {
  const via = mcpServer ? `the ${mcpServer} Slack MCP server` : "the Slack MCP";
  const at = ref.threadTs
    ? `channel ${ref.channelId}, thread_ts ${ref.threadTs}`
    : `channel ${ref.channelId}`;
  const context = `Slack context (read it first via ${via}; ${at}): ${ref.url}`;
  return `${context}\n\n${prompt}`;
}
