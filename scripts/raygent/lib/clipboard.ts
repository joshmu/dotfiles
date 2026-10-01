import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { herdrRegistryPath } from "./herdr";
import type { ClipCandidate } from "./slack-link";

export function readClipboard(): string {
  return Bun.spawnSync(["pbpaste"]).stdout.toString();
}

/** NSPasteboard's change counter; bumps on every copy, even of identical text. */
export function clipboardChangeCount(): number {
  const r = Bun.spawnSync([
    "osascript",
    "-l",
    "JavaScript",
    "-e",
    'ObjC.import("AppKit"); $.NSPasteboard.generalPasteboard.changeCount',
  ]);
  const n = Number(r.stdout.toString().trim());
  return Number.isFinite(n) ? n : -1;
}

function stateDir(): string {
  return dirname(herdrRegistryPath());
}

/** Slack links recorded by clip-watch (empty when it isn't installed). */
export function readWatchedClips(): ClipCandidate[] {
  const p = join(stateDir(), "slack-clips.json");
  if (!existsSync(p)) return [];
  try {
    const clips = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(clips)
      ? clips.map((c: any) => ({ text: String(c.url), changeCount: c.changeCount, at: c.at }))
      : [];
  } catch {
    return [];
  }
}

function launchStatePath(): string {
  return join(stateDir(), "clipboard.json");
}

/** Change count at the previous Raycast launch, or null on first run. */
export function lastLaunchCount(): number | null {
  return readLaunchState().changeCount;
}

/** When the previous Raycast launch happened (epoch ms), or null. */
export function lastLaunchAt(): number | null {
  return readLaunchState().at;
}

function readLaunchState(): { changeCount: number | null; at: number | null } {
  const p = launchStatePath();
  if (!existsSync(p)) return { changeCount: null, at: null };
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    const num = (v: unknown) => (typeof v === "number" ? v : null);
    return { changeCount: num(j.changeCount), at: num(j.at) };
  } catch {
    return { changeCount: null, at: null };
  }
}

/** Recorded on every Raycast launch, used or not, so each copy is only ever considered once. */
export function recordLaunchCount(current: number): void {
  const p = launchStatePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ changeCount: current, at: Date.now() }));
}
