/** macOS notification; the message is passed as an argument, never interpolated into AppleScript. */
export function notify(message: string, title = "raygent"): void {
  Bun.spawnSync([
    "osascript",
    "-e",
    "on run argv",
    "-e",
    "display notification (item 1 of argv) with title (item 2 of argv)",
    "-e",
    "end run",
    message,
    title,
  ]);
}
