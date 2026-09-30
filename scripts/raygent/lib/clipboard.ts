import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { herdrRegistryPath } from "./herdr";

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

function statePath(): string {
  return join(dirname(herdrRegistryPath()), "clipboard.json");
}

/** True when something was copied since the last Raycast launch (or on first run). */
export function clipboardChangedSinceLastLaunch(current: number): boolean {
  if (current < 0) return false;
  const p = statePath();
  if (!existsSync(p)) return true;
  try {
    return JSON.parse(readFileSync(p, "utf8")).changeCount !== current;
  } catch {
    return true;
  }
}

/** Recorded on every Raycast launch, used or not, so a copy is only ever considered once. */
export function recordClipboardSeen(current: number): void {
  const p = statePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ changeCount: current }));
}
