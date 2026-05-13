#!/usr/bin/env bun
import { $ } from "bun";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

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

  const hash = createHash("sha1").update(text).digest("hex").slice(0, 12);
  const outPath = join(tmpdir(), `say-${hash}.aiff`);

  const result = await $`say -o ${outPath} ${text}`.quiet().nothrow();
  if (result.exitCode !== 0) process.exit(result.exitCode);

  console.log(outPath);
}

main().catch((e) => {
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
});
