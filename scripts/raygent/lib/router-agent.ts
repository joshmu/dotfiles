import { join, dirname } from "path";
import { appendFileSync } from "fs";

const TIMEOUT_MS = 60000;
const CONFIG_PATH = join(dirname(import.meta.dir), "config.json");
const DEBUG_LOG = "/tmp/raygent-debug.log";

const ADJECTIVES = ["quick", "bright", "calm", "bold", "keen", "warm", "cool", "swift"];
const NOUNS = ["task", "query", "quest", "spark", "orbit", "pulse", "forge", "draft"];

function debugLog(label: string, data: unknown): void {
  if (!process.env.RAYGENT_DEBUG) return;
  const ts = new Date().toISOString();
  const payload = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  appendFileSync(DEBUG_LOG, `[${ts}] [${label}] ${payload}\n`);
}

export interface WorkspaceConfig {
  path: string;
  keywords: string[];
  exactKeywords?: string[];
  tmuxSession?: string;
}

export interface Config {
  default: string;
  workspaces: Record<string, WorkspaceConfig>;
}

export interface SessionConfig {
  name: string;
  cwd: string;
  tmuxSession?: string;
}

export async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await Bun.file(CONFIG_PATH).text());
  } catch {
    throw new Error(
      `Failed to load config from ${CONFIG_PATH}. Copy config.example.json to config.json`,
    );
  }
}

export function findExactMatch(
  prompt: string,
  config: Config,
): { workspace: string; config: WorkspaceConfig } | null {
  const lowerPrompt = prompt.toLowerCase();
  for (const [name, ws] of Object.entries(config.workspaces)) {
    if (ws.exactKeywords?.some((kw) => lowerPrompt.includes(kw.toLowerCase()))) {
      return { workspace: name, config: ws };
    }
  }
  return null;
}

export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidName(name: string): boolean {
  if (name.length < 2 || name.length > 40) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(name)) return false;
  if (/^[0-9a-f-]+$/.test(name) && name.replace(/-/g, "").length >= 8) return false;
  if (/^[0-9-]+$/.test(name)) return false;
  if (!/[a-z]{2,}/.test(name)) return false;
  return true;
}

export function fallbackName(): string {
  const now = Date.now();
  const adj = ADJECTIVES[now % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(now / 1000) % NOUNS.length];
  const suffix = (now % 1000).toString().padStart(3, "0");
  return `${adj}-${noun}-${suffix}`;
}

function buildSystemPrompt(config: Config): string {
  const workspaceNames = Object.keys(config.workspaces);
  const rules = workspaceNames
    .map((name) => {
      const isDefault = name === config.default ? " (default)" : "";
      return `- "${name}"${isDefault}: ${config.workspaces[name].keywords.join(", ")}`;
    })
    .join("\n");

  return `You are a task router. Given a user prompt, determine:
- "name": 2-4 word kebab-case task name
- "workspace": one of [${workspaceNames.map((n) => `"${n}"`).join(", ")}]

Workspace rules:
${rules}`;
}

function buildJsonSchema(workspaceNames: string[]): string {
  return JSON.stringify({
    type: "object",
    properties: {
      name: { type: "string" },
      workspace: { type: "string", enum: workspaceNames },
    },
    required: ["name", "workspace"],
  });
}

export async function generateSessionConfig(prompt: string): Promise<SessionConfig> {
  const config = await loadConfig();
  const defaultCwd = config.workspaces[config.default]?.path || process.cwd();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const workspaceNames = Object.keys(config.workspaces);
    const proc = Bun.spawn(
      [
        "claude",
        "-p",
        `${buildSystemPrompt(config)}\n\nUser prompt: "${prompt}"`,
        "--model",
        "haiku",
        "--output-format",
        "json",
        "--json-schema",
        buildJsonSchema(workspaceNames),
        "--tools",
        "",
      ],
      { signal: controller.signal },
    );

    const output = await new Response(proc.stdout).text();
    clearTimeout(timeout);
    debugLog("raw-output", output);

    if ((await proc.exited) !== 0) {
      console.error(`[router] Claude exited with non-zero code`);
      debugLog("fallback", { reason: "non-zero exit code" });
      return { name: fallbackName(), cwd: defaultCwd, tmuxSession: undefined };
    }

    const parsed = JSON.parse(output).structured_output;
    debugLog("parsed", parsed);
    if (!parsed) {
      console.error(`[router] No structured_output in response`);
      debugLog("fallback", { reason: "no structured_output" });
      return { name: fallbackName(), cwd: defaultCwd, tmuxSession: undefined };
    }

    const sanitized = sanitizeName(parsed.name || "");
    let name: string;
    if (!sanitized || !isValidName(sanitized)) {
      debugLog("name-rejected", { raw: parsed.name, sanitized });
      name = fallbackName();
    } else {
      name = sanitized;
    }

    const matchedWorkspace = config.workspaces[parsed.workspace];
    return {
      name,
      cwd: matchedWorkspace?.path || defaultCwd,
      tmuxSession: matchedWorkspace?.tmuxSession,
    };
  } catch (err) {
    console.error(`[router] Error:`, err);
    debugLog("fallback", { reason: "exception", error: String(err) });
    return { name: fallbackName(), cwd: defaultCwd, tmuxSession: undefined };
  }
}

if (import.meta.main) {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error('Usage: bun router-agent.ts "your prompt"');
    process.exit(1);
  }
  console.log(JSON.stringify(await generateSessionConfig(prompt), null, 2));
}
