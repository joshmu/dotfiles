/** Herdr agent names must match this and be unique among live agents. */
export const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const MAX = 32;

/** Coerces any label (Haiku name, Slack channel, DM name) into a valid Herdr agent name. */
export function toAgentName(raw: string, fallback = "raygent"): string {
  let name = raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (!name) name = fallback;
  if (!/^[a-z]/.test(name)) name = `s-${name}`;
  return name.slice(0, MAX).replace(/[-_]+$/, "");
}

/** Appends -2, -3… (truncating the base to fit) until the name is not taken. */
export function uniqueAgentName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, MAX - suffix.length).replace(/[-_]+$/, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
