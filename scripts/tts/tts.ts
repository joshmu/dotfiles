#!/usr/bin/env bun
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { $ } from "bun";

export interface ProviderConfig {
  togglePath?: string;
  summarizer: string;
  maxChars?: number;
  voice?: string;
  modelDir?: string;
  scriptPath?: string;
}

export interface SummarizerConfig {
  maxChars?: number;
  lines?: number;
  timeoutMs?: number;
  fallbackSummarizer?: string;
}

export interface Config {
  cascade: string[];
  providers: Record<string, ProviderConfig>;
  summarizers: Record<string, SummarizerConfig>;
}

export interface HookCtx {
  hookEvent?: string;
  sessionName?: string;
  windowName?: string;
  transcriptPath?: string;
  message?: string;
}

export type ToggleChecker = (path: string) => boolean;
export type RunSummarizer = (name: string, ctx: HookCtx, cfg: SummarizerConfig) => Promise<string>;
export type RunProvider = (
  name: string,
  text: string,
  cfg: ProviderConfig,
) => Promise<string | null>;

export function expandPath(p: string): string {
  if (!p) return p;
  if (p.startsWith("~/")) return join(process.env.HOME || "", p.slice(2));
  return p;
}

export function pickTier(config: Config, isToggleOn: ToggleChecker): string | null {
  for (const name of config.cascade) {
    const p = config.providers[name];
    if (!p) continue;
    if (!p.togglePath) return name;
    if (isToggleOn(expandPath(p.togglePath))) return name;
  }
  return null;
}

export interface OrchestrateOpts {
  mode: "manual" | "hook";
  text?: string;
  ctx?: HookCtx;
  config: Config;
  isToggleOn: ToggleChecker;
  runSummarizer: RunSummarizer;
  runProvider: RunProvider;
}

export async function orchestrate(opts: OrchestrateOpts): Promise<string | null> {
  if (opts.mode === "manual") {
    const text = (opts.text || "").trim();
    if (!text) return null;
    return walkCascade(opts.config, opts.isToggleOn, text, opts.runProvider);
  }

  for (const tierName of opts.config.cascade) {
    const provider = opts.config.providers[tierName];
    if (!provider) continue;
    if (provider.togglePath && !opts.isToggleOn(expandPath(provider.togglePath))) continue;

    let text = "";
    try {
      text = await opts.runSummarizer(
        provider.summarizer,
        opts.ctx || {},
        opts.config.summarizers[provider.summarizer] || {},
      );
    } catch {
      const fallback = opts.config.summarizers[provider.summarizer]?.fallbackSummarizer;
      if (fallback) {
        try {
          text = await opts.runSummarizer(
            fallback,
            opts.ctx || {},
            opts.config.summarizers[fallback] || {},
          );
        } catch {
          text = "";
        }
      }
    }

    if (!text) continue;
    const audio = await opts.runProvider(tierName, text, provider);
    if (audio) return audio;
  }
  return null;
}

async function walkCascade(
  config: Config,
  isToggleOn: ToggleChecker,
  text: string,
  runProvider: RunProvider,
): Promise<string | null> {
  for (const tierName of config.cascade) {
    const provider = config.providers[tierName];
    if (!provider) continue;
    if (provider.togglePath && !isToggleOn(expandPath(provider.togglePath))) continue;
    const audio = await runProvider(tierName, text, provider);
    if (audio) return audio;
  }
  return null;
}

// ----- Real subprocess implementations (used by CLI, not by tests) -----

function loadConfig(): Config {
  const configPath = join(dirname(import.meta.path), "config.json");
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

const realIsToggleOn: ToggleChecker = (p) => existsSync(p);

const realRunSummarizer: RunSummarizer = async (name, ctx, cfg) => {
  const scriptDir = join(dirname(import.meta.path), "summarizers");
  const scriptPath = join(scriptDir, `${name}.ts`);
  if (!existsSync(scriptPath)) throw new Error(`summarizer not found: ${name}`);
  const input = JSON.stringify({ ctx, cfg });
  const proc = Bun.spawn(["bun", scriptPath], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(input);
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`summarizer ${name} exit ${exitCode}`);
  return stdout.trim();
};

const realRunProvider: RunProvider = async (name, text, cfg) => {
  const providersDir = join(dirname(import.meta.path), "providers");
  const candidates = [`${name}.ts`, `${name}.py`];
  let scriptPath: string | null = null;
  for (const c of candidates) {
    const p = join(providersDir, c);
    if (existsSync(p)) {
      scriptPath = p;
      break;
    }
  }
  if (!scriptPath) return null;

  const runner = scriptPath.endsWith(".ts") ? "bun" : scriptPath;
  const argv = scriptPath.endsWith(".ts") ? [runner, scriptPath, text] : [scriptPath, text];

  try {
    const result = await $`${{ raw: argv.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ") }}`
      .quiet()
      .nothrow()
      .env({ ...process.env, TTS_PROVIDER_CONFIG: JSON.stringify(cfg) });
    if (result.exitCode !== 0) return null;
    const stdout = result.stdout.toString().trim();
    const lines = stdout.split("\n");
    const last = lines[lines.length - 1];
    return last && existsSync(last) ? last : null;
  } catch {
    return null;
  }
};

// ----- CLI entrypoint -----

async function main() {
  const args = process.argv.slice(2);
  const hookMode = args.includes("--hook-mode");
  const config = loadConfig();

  if (hookMode) {
    const input = await Bun.stdin.text();
    let ctx: HookCtx = {};
    try {
      const parsed = JSON.parse(input || "{}");
      ctx = {
        hookEvent: parsed.hook_event_name || parsed.hookEvent,
        sessionName: parsed.sessionName,
        windowName: parsed.windowName || parsed.window_name,
        transcriptPath: parsed.transcript_path || parsed.transcriptPath,
        message: parsed.message,
      };
    } catch {}
    const audio = await orchestrate({
      mode: "hook",
      ctx,
      config,
      isToggleOn: realIsToggleOn,
      runSummarizer: realRunSummarizer,
      runProvider: realRunProvider,
    });
    if (audio) console.log(audio);
    process.exit(audio ? 0 : 1);
  }

  const text = args.filter((a) => !a.startsWith("--")).join(" ") || (await Bun.stdin.text());
  const audio = await orchestrate({
    mode: "manual",
    text,
    config,
    isToggleOn: realIsToggleOn,
    runSummarizer: realRunSummarizer,
    runProvider: realRunProvider,
  });
  if (audio) console.log(audio);
  process.exit(audio ? 0 : 1);
}

if (import.meta.main) {
  main().catch((e) => {
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  });
}
