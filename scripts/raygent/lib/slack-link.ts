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

export interface PickInput {
  prompt: string;
  clipboard: string;
  clipboardChanged: boolean;
  isScheduled: boolean;
}

export interface Picked {
  ref: SlackRef | null;
  fromClipboard: boolean;
  prompt: string; // prompt with the opt-out prefix removed
}

/**
 * A link in the prompt wins. The clipboard is used only when it holds exactly one
 * Slack link that was copied since the last launch, so an old copy can't hijack
 * an unrelated prompt.
 */
export function pickSlackRef(input: PickInput): Picked {
  const trimmed = input.prompt.trimStart();
  const optOut = trimmed.toLowerCase().startsWith(NO_CLIPBOARD_PREFIX);
  const prompt = optOut ? trimmed.slice(NO_CLIPBOARD_PREFIX.length).trim() : input.prompt;
  if (input.isScheduled) return { ref: null, fromClipboard: false, prompt };

  const inPrompt = parseSlackUrl(prompt);
  if (inPrompt) return { ref: inPrompt, fromClipboard: false, prompt };

  const clip = input.clipboard.trim();
  if (optOut || !input.clipboardChanged || /\s/.test(clip))
    return { ref: null, fromClipboard: false, prompt };
  const ref = parseSlackUrl(clip);
  return ref && ref.url === clip
    ? { ref, fromClipboard: true, prompt }
    : { ref: null, fromClipboard: false, prompt };
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
