import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pastedSince } from "./pasted";

const URL = "https://acme.slack.com/archives/C0123ABCDEF/p1790663425161349";

describe("pastedSince", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "raygent-pasted-"));
    mkdirSync(join(root, "-w-project"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const transcript = (name: string, body: string, mtimeMs: number) => {
    const p = join(root, "-w-project", name);
    writeFileSync(p, body);
    utimesSync(p, mtimeMs / 1000, mtimeMs / 1000);
  };

  test("finds the link in a transcript written since the copy", () => {
    transcript("a.jsonl", `{"message":{"content":"look at ${URL}"}}\n`, 2_000_000);
    expect(pastedSince(URL, 1_000_000, root)).toBe(true);
  });

  test("ignores transcripts last written before the copy", () => {
    transcript("a.jsonl", `{"message":{"content":"${URL}"}}\n`, 500_000);
    expect(pastedSince(URL, 1_000_000, root)).toBe(false);
  });

  test("false when no recent transcript mentions it", () => {
    transcript("a.jsonl", `{"message":{"content":"something else"}}\n`, 2_000_000);
    expect(pastedSince(URL, 1_000_000, root)).toBe(false);
    expect(pastedSince(URL, 1_000_000, join(root, "missing"))).toBe(false);
  });
});
