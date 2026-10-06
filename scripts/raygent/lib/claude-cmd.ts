import { writeFileSync } from "fs";
import { join } from "path";

const BASE_FLAG = "--permission-mode auto";

export function buildClaudeArgs(extraArgs?: string): string {
  const trimmed = extraArgs?.trim();
  if (!trimmed) return BASE_FLAG;
  // Caller already chose a permission posture (auto/bypass/etc) — don't layer
  // another permission flag on top of it.
  if (trimmed.includes("permission-mode") || trimmed.includes("dangerously-skip")) {
    return trimmed;
  }
  return `${BASE_FLAG} ${trimmed}`;
}

export function buildClaudeArgv(extraArgs?: string): string[] {
  return buildClaudeArgs(extraArgs).split(/\s+/).filter(Boolean);
}

/**
 * Writes a launch prompt to a file of its own for the pane's shell to `cat`.
 * Named by the launch's Claude session id and created exclusively: a timestamp
 * name let two scheduled tasks firing in the same millisecond share one file,
 * so both panes started with whichever prompt was written last.
 */
export function writePromptFile(prompt: string, sessionId: string, dir = "/tmp"): string {
  const path = join(dir, `raygent-prompt-${sessionId}.txt`);
  writeFileSync(path, prompt, { flag: "wx" });
  return path;
}
