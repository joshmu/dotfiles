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

export const NO_CLIPBOARD_PREFIX = "!noclip";

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
}

export interface Picked {
  ref: SlackRef | null;
  fromClipboard: boolean;
  prompt: string; // prompt with the opt-out prefix removed
}

/**
 * A link in the prompt wins. Otherwise the newest clipboard entry that is exactly
 * one Slack link, copied since the last launch and within the last 10 minutes, so
 * later copies (e.g. dictation) don't hide it and an old copy can't hijack an
 * unrelated prompt.
 */
export function pickSlackRef(input: PickInput): Picked {
  const trimmed = input.prompt.trimStart();
  const optOut = trimmed.toLowerCase().startsWith(NO_CLIPBOARD_PREFIX);
  const prompt = optOut ? trimmed.slice(NO_CLIPBOARD_PREFIX.length).trim() : input.prompt;
  const none = { ref: null, fromClipboard: false, prompt };
  if (input.isScheduled) return none;

  const inPrompt = parseSlackUrl(prompt);
  if (inPrompt) return { ref: inPrompt, fromClipboard: false, prompt };
  if (optOut) return none;

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
    if (ref && ref.url === text) return { ref, fromClipboard: true, prompt };
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
