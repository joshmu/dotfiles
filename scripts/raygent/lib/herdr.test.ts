import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { appendRegistry, herdrRegistryPath, readRegistry, runLabel } from "./herdr";

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
});
