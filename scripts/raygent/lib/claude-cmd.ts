const BASE_FLAG = "--allow-dangerously-skip-permissions";

export function buildClaudeArgs(extraArgs?: string): string {
  const trimmed = extraArgs?.trim();
  return trimmed ? `${BASE_FLAG} ${trimmed}` : BASE_FLAG;
}
