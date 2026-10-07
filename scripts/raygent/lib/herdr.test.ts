import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  HerdrError,
  appendRegistry,
  herdrRegistryPath,
  parseHerdrOutput,
  readRegistry,
  runLabel,
} from "./herdr";

describe("runLabel", () => {
  test("formats task plus zero-padded local month-day and time", () => {
    expect(runLabel("zoom", new Date(2026, 0, 5, 7, 3))).toBe("zoom 01-05 07:03");
  });
});

describe("run registry", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raygent-herdr-"));
    process.env.RAYGENT_STATE_DIR = dir;
  });
  afterEach(() => {
    delete process.env.RAYGENT_STATE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  test("honours RAYGENT_STATE_DIR", () => {
    expect(herdrRegistryPath()).toBe(join(dir, "herdr-runs.json"));
  });

  test("starts empty and appends records", () => {
    expect(readRegistry()).toEqual([]);
    const run = {
      tabId: "w2:t1",
      paneId: "w2:p1",
      label: "x 09-24 14:34",
      task: "x",
      claudeSessionId: "id",
      launched: 1,
      herdrSession: "",
    };
    appendRegistry(run);
    appendRegistry({ ...run, tabId: "w2:t2" });
    expect(readRegistry().map((r) => r.tabId)).toEqual(["w2:t1", "w2:t2"]);
  });

  test("concurrent writers in separate processes lose no entries", async () => {
    const lib = join(import.meta.dir, "herdr.ts");
    const writer = (n: number) =>
      Bun.spawn(
        [
          process.execPath,
          "-e",
          `import { appendRegistry } from ${JSON.stringify(lib)};
           for (let i = 0; i < 15; i++)
             appendRegistry({ tabId: "w${n}:t" + i, paneId: "p", label: "l", task: "t",
               claudeSessionId: "s", launched: 1, herdrSession: "" });`,
        ],
        { env: { ...process.env, RAYGENT_STATE_DIR: dir }, stderr: "pipe" },
      );
    const procs = Array.from({ length: 6 }, (_, n) => writer(n));
    expect(await Promise.all(procs.map((p) => p.exited))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(readRegistry()).toHaveLength(90);
    expect(new Set(readRegistry().map((r) => r.tabId)).size).toBe(90);
  });
});

describe("parseHerdrOutput", () => {
  test("returns result from stdout", () => {
    expect(parseHerdrOutput(["x"], '{"id":"a","result":{"ok":1}}', "", 0)).toEqual({ ok: 1 });
  });

  test("empty output with exit 0 is null", () => {
    expect(parseHerdrOutput(["pane", "run"], "", "", 0)).toBeNull();
  });

  test("error JSON on stderr throws HerdrError with its code", () => {
    const stderr = '{"error":{"code":"protocol_mismatch","message":"restart"},"id":"cli:x"}';
    let err: any;
    try {
      parseHerdrOutput(["agent", "list"], "", stderr, 1);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HerdrError);
    expect(err.code).toBe("protocol_mismatch");
  });

  test("non-JSON failure is unparseable", () => {
    expect(() => parseHerdrOutput(["x"], "", "boom", 1)).toThrow(/boom/);
  });
});
