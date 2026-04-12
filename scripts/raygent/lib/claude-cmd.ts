const BASE_FLAG = "--allow-dangerously-skip-permissions";

export function buildClaudeArgs(extraArgs?: string): string {
  const trimmed = extraArgs?.trim();
  if (!trimmed) return BASE_FLAG;
  if (trimmed.includes("dangerously-skip")) return trimmed;
  return `${BASE_FLAG} ${trimmed}`;
}
