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

/**
 * Single-letter mods, the first tokens of a prompt (before any `:command`). Only an exact,
 * lowercase, standalone token counts, so "s3 bucket" or "S and P" are ordinary prompts.
 * Add a letter here to add a mod.
 */
export const MODS = { s: "slack" } as const;
export type Mod = (typeof MODS)[keyof typeof MODS];

const COMMAND = /^:([a-z0-9][a-z0-9_-]*)$/i;

export interface Flags {
  prompt: string; // prompt with the leading mods and commands removed
  mods: Mod[]; // `s`: bind to the Slack link most recently copied
  fresh: boolean; // `:new`: start a new session even if one could be resumed
  target?: string; // `:<query>`: send to the existing agent the picker ranks first
}

/**
 * `<mods> <:commands> <prompt>`, both optional. Mods first; then `:word` commands in any
 * order: `:new`, else the first other word is the agent query.
 */
export function parseFlags(prompt: string): Flags {
  const tokens = prompt.trim().split(/\s+/);
  const mods: Mod[] = [];
  let fresh = false;
  let target: string | undefined;
  let i = 0;
  for (; i < tokens.length && Object.hasOwn(MODS, tokens[i]); i++) {
    const mod = MODS[tokens[i] as keyof typeof MODS];
    if (!mods.includes(mod)) mods.push(mod);
  }
  for (; i < tokens.length; i++) {
    const m = COMMAND.exec(tokens[i]);
    if (!m) break;
    const word = m[1].toLowerCase();
    if (word === "new") fresh = true;
    else if (!target) target = word;
  }
  if (i === 0) return { prompt, mods, fresh, target };
  return { prompt: stripLeading(prompt, i), mods, fresh, target };
}

/** Removes the first `n` whitespace-separated tokens, keeping the rest of the prompt verbatim. */
function stripLeading(prompt: string, n: number): string {
  let rest = prompt.trimStart();
  for (let k = 0; k < n; k++) rest = rest.replace(/^\S+\s*/, "");
  return rest;
}

/** A Slack link recorded by clip-watch. */
export interface ClipCandidate {
  text: string;
  changeCount: number; // NSPasteboard change count when it was copied
  at: number; // epoch ms
}

/** The clipboard, read only when a prompt asks for it. */
export interface Clipboard {
  live: string; // current clipboard text
  watched: ClipCandidate[]; // clip-watch records (empty when it isn't installed)
}

export interface PickInput {
  prompt: string;
  clipboard: () => Clipboard;
  isScheduled: boolean;
}

export interface Picked {
  ref: SlackRef | null;
  fromClipboard: boolean;
  mods: Mod[];
  fresh: boolean;
  target?: string;
  prompt: string; // prompt with leading mods and commands removed
}

/**
 * The most recently copied Slack link: the live clipboard is the newest copy, so a link
 * on it wins; otherwise clip-watch's newest record (copies that replaced it, e.g.
 * dictation, don't hide it).
 */
export function latestClipboardRef(clipboard: Clipboard): SlackRef | null {
  const live = parseSlackUrl(clipboard.live);
  if (live) return live;
  const newest = [...clipboard.watched].sort((a, b) => b.at - a.at);
  for (const c of newest) {
    const ref = parseSlackUrl(c.text);
    if (ref) return ref;
  }
  return null;
}

/**
 * A link typed in the prompt binds the session, except for an `:<agent>` send, which goes
 * as typed. The clipboard is read only with the `s` mod: then a typed link still wins,
 * else the most recently copied Slack link is used, `:<agent>` sends included.
 */
export function pickSlackRef(input: PickInput): Picked {
  const { prompt, mods, fresh, target } = parseFlags(input.prompt);
  const none = { ref: null, fromClipboard: false, mods, fresh, target, prompt };
  if (input.isScheduled) return none;
  const slackMod = mods.includes("slack");
  if (target && !slackMod) return none;

  const inPrompt = parseSlackUrl(prompt);
  if (inPrompt) return { ...none, ref: inPrompt };
  if (!slackMod) return none;
  const copied = latestClipboardRef(input.clipboard());
  return copied ? { ...none, ref: copied, fromClipboard: true } : none;
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
