#!/usr/bin/env bun
/**
 * Dynamic voice summary via `claude -p` headless invocation.
 *
 * Recursion-safe: spawns claude with `--settings '{"disableAllHooks":true}'` + cwd=/tmp.
 *   - --settings disableAllHooks=true → Stop/Notification hooks don't fire in subprocess
 *   - cwd=/tmp → no CLAUDE.md auto-discovery → small system prompt → no "Prompt is too long"
 *   - Preserves OAuth subscription auth (no ANTHROPIC_API_KEY needed, unlike --bare)
 *
 * Falls back to canned summarizer on any failure (timeout, empty output, missing transcript).
 */
import { existsSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { tmpdir } from "os";

interface Ctx {
  hookEvent?: string;
  sessionName?: string;
  windowName?: string;
  transcriptPath?: string;
  message?: string;
}

interface Cfg {
  maxChars?: number;
  lines?: number;
  timeoutMs?: number;
  fallbackSummarizer?: string;
  model?: string;
}

const DEFAULT_CFG: Required<Cfg> = {
  maxChars: 200,
  lines: 2,
  timeoutMs: 30000,
  fallbackSummarizer: "canned",
  model: "haiku",
};

export function extractFullLastAssistant(transcriptPath: string | undefined): string {
  if (!transcriptPath || !existsSync(transcriptPath)) return "";
  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        const role = obj.role || obj.type || obj.message?.role;
        if (role !== "assistant") continue;
        const raw = obj.content || obj.message?.content || obj.text;
        let text = "";
        if (typeof raw === "string") text = raw;
        else if (Array.isArray(raw)) {
          // Concatenate all text blocks for completeness.
          text = raw
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text || "")
            .join("\n")
            .trim();
        }
        text = text.trim();
        if (text) return text;
      } catch {
        // skip malformed
      }
    }
  } catch {}
  return "";
}

function buildSystemPrompt(prefix: string): string {
  return `You generate concise voice notification summaries.
Output format: "${prefix} - <one or two short sentences>".
Plain English, present tense, no markdown, no code, no quotes, no preamble.
Under 200 characters total. Reply with ONLY the prefixed status text.`;
}

function buildUserPrompt(ctx: Ctx, assistantText: string): string {
  if (!assistantText) {
    return `Hook event: ${ctx.hookEvent || "Unknown"}\nMessage: ${ctx.message || "(none)"}\nGenerate the voice notification.`;
  }
  return `Summarize the following assistant response for a voice notification:\n\n<response>\n${assistantText}\n</response>\n\nReply ONLY with the prefixed status text.`;
}

async function callClaudeHaiku(
  systemPrompt: string,
  userPrompt: string,
  cfg: Required<Cfg>,
): Promise<string | null> {
  // Test injection short-circuit.
  if (process.env.HAIKU_STUB_OUTPUT !== undefined) {
    const stub = process.env.HAIKU_STUB_OUTPUT;
    return stub === "" || stub === "FAIL" ? null : stub;
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(
        "claude",
        [
          "-p",
          "--settings",
          '{"disableAllHooks":true}',
          "--no-session-persistence",
          "--model",
          cfg.model,
          "--system-prompt",
          systemPrompt,
          userPrompt,
        ],
        {
          cwd: tmpdir(),
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        proc.kill();
      } catch {}
      resolve(null);
    }, cfg.timeoutMs);
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (process.env.DEBUG) console.error("haiku spawn error:", stderr);
      resolve(null);
    });
    proc.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        if (process.env.DEBUG) console.error(`haiku exit ${code}:`, stderr);
        resolve(null);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function cleanSummary(raw: string, cfg: Required<Cfg>): string {
  let text = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, cfg.lines);
  text = lines.join(" ");
  if (text.length > cfg.maxChars) text = text.slice(0, cfg.maxChars - 1) + "…";
  return text;
}

async function fallbackCanned(ctx: Ctx): Promise<string> {
  const cannedScript = `${import.meta.dir}/canned.ts`;
  if (!existsSync(cannedScript)) {
    return ctx.sessionName ? `${ctx.sessionName} requires attention` : "Notification";
  }
  return new Promise((resolve) => {
    const proc = spawn("bun", [cannedScript], { stdio: ["pipe", "pipe", "ignore"] });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stdin.write(JSON.stringify({ ctx }));
    proc.stdin.end();
    proc.on("exit", () => resolve(out.trim() || "Notification"));
    proc.on("error", () => resolve("Notification"));
  });
}

async function main() {
  if (process.stdin.isTTY) process.exit(0);
  const input = await Bun.stdin.text();
  let ctx: Ctx = {};
  let cfg: Required<Cfg> = { ...DEFAULT_CFG };
  try {
    const parsed = JSON.parse(input || "{}");
    ctx = parsed.ctx || {};
    cfg = { ...DEFAULT_CFG, ...(parsed.cfg || {}) };
  } catch {}

  const session = (ctx.sessionName || "session").toLowerCase();
  const prefix = ctx.windowName ? `${session}-${ctx.windowName}` : session;
  const assistantText = extractFullLastAssistant(ctx.transcriptPath);

  const systemPrompt = buildSystemPrompt(prefix);
  const userPrompt = buildUserPrompt(ctx, assistantText);
  const raw = await callClaudeHaiku(systemPrompt, userPrompt, cfg);

  if (!raw) {
    const fallback = await fallbackCanned(ctx);
    console.log(fallback);
    process.exit(0);
  }

  console.log(cleanSummary(raw, cfg));
}

if (import.meta.main) {
  main().catch(async (e) => {
    if (process.env.DEBUG) console.error(e);
    const fallback = await fallbackCanned({}).catch(() => "Notification");
    console.log(fallback);
    process.exit(0);
  });
}
