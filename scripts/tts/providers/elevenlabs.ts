#!/usr/bin/env bun
import { existsSync } from "fs";
import { join } from "path";

interface ProviderConfig {
  scriptPath?: string;
  maxChars?: number;
}

function expandPath(p: string): string {
  if (!p) return p;
  if (p.startsWith("~/")) return join(process.env.HOME || "", p.slice(2));
  return p;
}

async function readText(): Promise<string> {
  const argText = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--"))
    .join(" ")
    .trim();
  if (argText) return argText;
  if (process.stdin.isTTY) return "";
  try {
    return (await Bun.stdin.text()).trim();
  } catch {
    return "";
  }
}

async function main() {
  const text = await readText();
  if (!text) process.exit(0);

  let cfg: ProviderConfig = {};
  try {
    cfg = JSON.parse(process.env.TTS_PROVIDER_CONFIG || "{}");
  } catch {}

  const scriptPath = expandPath(
    cfg.scriptPath || "~/dotfiles/scripts/elevenlabs/elevenlabs-tts.ts",
  );
  if (!existsSync(scriptPath)) {
    if (process.env.DEBUG) console.error(`elevenlabs script missing: ${scriptPath}`);
    process.exit(1);
  }

  const maxChars = cfg.maxChars || 250;
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "…" : text;

  const proc = Bun.spawn([scriptPath, truncated], { stdout: "pipe", stderr: "inherit" });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) process.exit(exitCode);

  const lines = stdout.trim().split("\n");
  const audioPath = lines[lines.length - 1];
  if (!audioPath || !existsSync(audioPath)) process.exit(1);
  console.log(audioPath);
}

main().catch((e) => {
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
});
