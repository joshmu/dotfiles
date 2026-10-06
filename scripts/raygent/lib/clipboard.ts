import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { herdrRegistryPath } from "./herdr";
import type { ClipCandidate, Clipboard } from "./slack-link";

export function readClipboard(): string {
  return Bun.spawnSync(["pbpaste"]).stdout.toString();
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

/** The live clipboard plus clip-watch's records. */
export function readClipboardState(): Clipboard {
  return { live: readClipboard(), watched: readWatchedClips() };
}
