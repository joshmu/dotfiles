import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const script = `${import.meta.dir}/elevenlabs.ts`;
const stubDir = join(tmpdir(), "tts-elevenlabs-stub");
const stubScript = join(stubDir, "elevenlabs-stub.ts");
const stubAudio = join(stubDir, "fake.mp3");

async function runScript(
  args: string[] = [],
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", script, ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout, stderr };
}

beforeAll(() => {
  mkdirSync(stubDir, { recursive: true });
  writeFileSync(stubAudio, "fake mp3 bytes");
  // Stub script that mimics elevenlabs-tts contract: prints audio path on last stdout line
  writeFileSync(
    stubScript,
    `#!/usr/bin/env bun
const text = process.argv[2] || "";
console.error("stub received:", text.length, "chars");
console.log("${stubAudio}");
`,
  );
  chmodSync(stubScript, 0o755);
});

afterAll(() => {
  rmSync(stubDir, { recursive: true, force: true });
});

describe("elevenlabs provider adapter", () => {
  test("empty text → exit 0, no output", async () => {
    const r = await runScript([], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ scriptPath: stubScript }),
    });
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  test("text passed through, audio path echoed", async () => {
    const r = await runScript(["hello world"], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ scriptPath: stubScript }),
    });
    expect(r.code).toBe(0);
    expect(r.stdout.trim().split("\n").pop()).toBe(stubAudio);
  });

  test("maxChars truncates long text before forwarding", async () => {
    const longText = "x".repeat(500);
    const r = await runScript([longText], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ scriptPath: stubScript, maxChars: 50 }),
    });
    expect(r.code).toBe(0);
    // truncated length = maxChars + 1 for ellipsis (51), should be << 500
    expect(r.stderr).toMatch(/stub received: (5[01]) chars/);
  });

  test("missing scriptPath in config → exit non-zero", async () => {
    const r = await runScript(["hello"], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ scriptPath: "/nonexistent/script.ts" }),
    });
    expect(r.code).not.toBe(0);
  });

  test("script returning non-existent file → exit non-zero", async () => {
    const badStub = join(stubDir, "bad-stub.ts");
    writeFileSync(
      badStub,
      `#!/usr/bin/env bun
console.log("/tmp/does-not-exist-xyz.mp3");
`,
    );
    chmodSync(badStub, 0o755);
    const r = await runScript(["hello"], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ scriptPath: badStub }),
    });
    expect(r.code).not.toBe(0);
  });
});
