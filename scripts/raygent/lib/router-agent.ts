import { join, dirname } from 'path';

const TIMEOUT_MS = 60000;
const CONFIG_PATH = join(dirname(import.meta.dir), 'config.json');

interface WorkspaceConfig {
  path: string;
  keywords: string[];
}

interface Config {
  default: string;
  workspaces: Record<string, WorkspaceConfig>;
}

interface SessionConfig {
  name: string;
  cwd: string;
}

async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await Bun.file(CONFIG_PATH).text());
  } catch {
    throw new Error(`Failed to load config from ${CONFIG_PATH}. Copy config.example.json to config.json`);
  }
}

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function buildSystemPrompt(config: Config): string {
  const workspaceNames = Object.keys(config.workspaces);
  const rules = workspaceNames
    .map((name) => {
      const isDefault = name === config.default ? ' (default)' : '';
      return `- "${name}"${isDefault}: ${config.workspaces[name].keywords.join(', ')}`;
    })
    .join('\n');

  return `You are a task router. Given a user prompt, determine:
- "name": 2-4 word kebab-case task name
- "workspace": one of [${workspaceNames.map((n) => `"${n}"`).join(', ')}]

Workspace rules:
${rules}`;
}

function buildJsonSchema(workspaceNames: string[]): string {
  return JSON.stringify({
    type: 'object',
    properties: {
      name: { type: 'string' },
      workspace: { type: 'string', enum: workspaceNames },
    },
    required: ['name', 'workspace'],
  });
}

export async function generateSessionConfig(prompt: string): Promise<SessionConfig> {
  const config = await loadConfig();
  const defaultCwd = config.workspaces[config.default]?.path || process.cwd();
  const fallbackName = () => `session-${Date.now().toString(36)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const workspaceNames = Object.keys(config.workspaces);
    const proc = Bun.spawn(
      [
        'claude', '-p', `${buildSystemPrompt(config)}\n\nUser prompt: "${prompt}"`,
        '--model', 'haiku',
        '--output-format', 'json',
        '--json-schema', buildJsonSchema(workspaceNames),
      ],
      { signal: controller.signal }
    );

    const output = await new Response(proc.stdout).text();
    clearTimeout(timeout);

    if (await proc.exited !== 0) {
      console.error(`[router] Claude exited with non-zero code`);
      return { name: fallbackName(), cwd: defaultCwd };
    }

    const parsed = JSON.parse(output).structured_output;
    if (!parsed) {
      console.error(`[router] No structured_output in response`);
      return { name: fallbackName(), cwd: defaultCwd };
    }

    return {
      name: sanitizeName(parsed.name || '') || fallbackName(),
      cwd: config.workspaces[parsed.workspace]?.path || defaultCwd,
    };
  } catch (err) {
    console.error(`[router] Error:`, err);
    return { name: fallbackName(), cwd: defaultCwd };
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
