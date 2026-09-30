import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { herdrRegistryPath } from "./herdr";
import type { SlackRef } from "./slack-link";

/** Per-machine Slack settings for one workspace, keyed by its host (e.g. acme.slack.com). */
export interface SlackWorkspace {
  authCommand?: string; // shell command printing a JSON object of HTTP headers for Web API calls
  mcpServer?: string; // Slack MCP server the launched session should use to read the conversation
  teamId?: string; // matches app.slack.com / slack:// links, which carry no host
}

export interface SlackConfig {
  workspaces: Record<string, SlackWorkspace>;
}

export function workspaceFor(ref: SlackRef, cfg?: SlackConfig): SlackWorkspace | undefined {
  if (!cfg) return undefined;
  if (ref.host) return cfg.workspaces[ref.host];
  return Object.values(cfg.workspaces).find((w) => w.teamId && w.teamId === ref.teamId);
}

/** Runs the configured auth command; null unless it prints a JSON object of string headers. */
export function authHeaders(command: string): Record<string, string> | null {
  const r = Bun.spawnSync(["sh", "-c", command]);
  if (r.exitCode !== 0) return null;
  try {
    const headers = JSON.parse(r.stdout.toString());
    const valid =
      headers &&
      typeof headers === "object" &&
      !Array.isArray(headers) &&
      Object.values(headers).every((v) => typeof v === "string" && v.length > 0);
    return valid ? headers : null;
  } catch {
    return null;
  }
}

export type SlackCall = (method: string, params: Record<string, string>) => Promise<any>;

export function slackApi(headers: Record<string, string>, timeoutMs = 3000): SlackCall {
  return async (method, params) => {
    const res = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(params)}`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json: any = await res.json();
    if (!json.ok) throw new Error(`slack ${method}: ${json.error ?? res.status}`);
    return json;
  };
}

/** Display label for a conversation: channel name, gdm-a-b for group DMs, dm-name for DMs. */
export async function conversationLabel(channelId: string, call: SlackCall): Promise<string> {
  const { channel } = await call("conversations.info", { channel: channelId });
  if (channel.is_im) {
    const { user } = await call("users.info", { user: channel.user });
    return `dm-${user.profile?.display_name || user.name || user.real_name || channel.user}`;
  }
  if (channel.is_mpim) {
    const { user: self } = await call("auth.test", {});
    const members = String(channel.name)
      .replace(/^mpdm-/, "")
      .replace(/-\d+$/, "")
      .split("--")
      .filter((m) => m && m !== self);
    return `gdm-${members.join("-")}`;
  }
  return channel.name;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cachePath(): string {
  return join(dirname(herdrRegistryPath()), "slack-names.json");
}

function readCache(): Record<string, { label: string; at: number }> {
  const p = cachePath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Label for a Slack conversation, cached for a week. Returns null on any failure
 * (no config, no auth, rejected auth, timeout) so the caller can fall back.
 */
export async function resolveLabel(
  key: string,
  ref: SlackRef,
  cfg: SlackConfig | undefined,
  call?: SlackCall,
  now = Date.now(),
): Promise<string | null> {
  const cache = readCache();
  const hit = cache[key];
  if (hit && now - hit.at < TTL_MS) return hit.label;
  let api = call;
  if (!api) {
    const command = workspaceFor(ref, cfg)?.authCommand;
    const headers = command ? authHeaders(command) : null;
    if (!headers) return null;
    api = slackApi(headers);
  }
  try {
    const label = await conversationLabel(ref.channelId, api);
    const p = cachePath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ ...cache, [key]: { label, at: now } }, null, 2));
    return label;
  } catch (e) {
    console.log(`slack name lookup failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
