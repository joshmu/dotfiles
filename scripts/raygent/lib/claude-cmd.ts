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
