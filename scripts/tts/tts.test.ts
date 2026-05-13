import { describe, test, expect } from "bun:test";
import { pickTier, expandPath, type Config, type ToggleChecker, orchestrate } from "./tts";

const baseConfig: Config = {
  cascade: ["elevenlabs", "kokoro", "say-default"],
  providers: {
    elevenlabs: { togglePath: "~/.toggles/elevenlabs", summarizer: "canned", maxChars: 250 },
    kokoro: { togglePath: "~/.toggles/kokoro", summarizer: "canned" },
    "say-default": { summarizer: "canned" },
  },
  summarizers: {
    canned: {},
  },
};

const allOff: ToggleChecker = () => false;
const onlyKokoro: ToggleChecker = (p) => p.endsWith("/kokoro");
const onlyElevenlabs: ToggleChecker = (p) => p.endsWith("/elevenlabs");
const bothOn: ToggleChecker = (p) => p.endsWith("/kokoro") || p.endsWith("/elevenlabs");

describe("expandPath", () => {
  test("expands leading ~ to HOME", () => {
    process.env.HOME = "/Users/test";
    expect(expandPath("~/.toggles/foo")).toBe("/Users/test/.toggles/foo");
  });

  test("leaves non-tilde paths unchanged", () => {
    expect(expandPath("/abs/path")).toBe("/abs/path");
  });
});

describe("pickTier", () => {
  test("picks first cascade entry whose toggle is ON", () => {
    expect(pickTier(baseConfig, onlyKokoro)).toBe("kokoro");
  });

  test("respects cascade order — elevenlabs wins when both ON", () => {
    expect(pickTier(baseConfig, bothOn)).toBe("elevenlabs");
  });

  test("falls through to say-default when no toggles ON", () => {
    expect(pickTier(baseConfig, allOff)).toBe("say-default");
  });

  test("say-default always selectable (no togglePath)", () => {
    expect(pickTier(baseConfig, allOff)).toBe("say-default");
  });

  test("picks elevenlabs when only its toggle is ON", () => {
    expect(pickTier(baseConfig, onlyElevenlabs)).toBe("elevenlabs");
  });

  test("returns null if cascade empty", () => {
    expect(pickTier({ ...baseConfig, cascade: [] }, allOff)).toBe(null);
  });
});

describe("orchestrate — manual mode", () => {
  test("manual text bypasses summarizer", async () => {
    let summarizerCalled = false;
    const audio = await orchestrate({
      mode: "manual",
      text: "hello",
      config: baseConfig,
      isToggleOn: onlyKokoro,
      runSummarizer: async () => {
        summarizerCalled = true;
        return "should not be used";
      },
      runProvider: async (_name, text) => `/tmp/out-${text}.wav`,
    });
    expect(summarizerCalled).toBe(false);
    expect(audio).toBe("/tmp/out-hello.wav");
  });

  test("empty manual text returns null", async () => {
    const audio = await orchestrate({
      mode: "manual",
      text: "",
      config: baseConfig,
      isToggleOn: onlyKokoro,
      runSummarizer: async () => "x",
      runProvider: async () => "/tmp/foo.wav",
    });
    expect(audio).toBe(null);
  });
});

describe("orchestrate — hook mode", () => {
  test("calls summarizer mapped to active tier", async () => {
    let calledWith: string | null = null;
    const audio = await orchestrate({
      mode: "hook",
      ctx: { hookEvent: "Stop", sessionName: "src" },
      config: baseConfig,
      isToggleOn: onlyKokoro,
      runSummarizer: async (name) => {
        calledWith = name;
        return "Build complete.";
      },
      runProvider: async (_name, text) => `/tmp/${text.length}.wav`,
    });
    expect(calledWith as string | null).toBe("canned");
    expect(audio).toBe("/tmp/15.wav");
  });

  test("elevenlabs tier also uses canned summarizer", async () => {
    let calledWith: string | null = null;
    await orchestrate({
      mode: "hook",
      ctx: { hookEvent: "Stop" },
      config: baseConfig,
      isToggleOn: onlyElevenlabs,
      runSummarizer: async (name) => {
        calledWith = name;
        return "Session finished";
      },
      runProvider: async () => "/tmp/eleven.wav",
    });
    expect(calledWith as string | null).toBe("canned");
  });

  test("provider returning null falls through to next tier", async () => {
    let attempts: string[] = [];
    const audio = await orchestrate({
      mode: "hook",
      ctx: { hookEvent: "Stop" },
      config: baseConfig,
      isToggleOn: bothOn,
      runSummarizer: async () => "msg",
      runProvider: async (name) => {
        attempts.push(name);
        if (name === "elevenlabs") return null;
        return "/tmp/kokoro.wav";
      },
    });
    expect(attempts).toEqual(["elevenlabs", "kokoro"]);
    expect(audio).toBe("/tmp/kokoro.wav");
  });

  test("all providers fail → returns null", async () => {
    const audio = await orchestrate({
      mode: "hook",
      ctx: { hookEvent: "Stop" },
      config: baseConfig,
      isToggleOn: bothOn,
      runSummarizer: async () => "msg",
      runProvider: async () => null,
    });
    expect(audio).toBe(null);
  });

  test("summarizer throwing → empty text → skip to next tier", async () => {
    const cfgWithThrowingTier: Config = {
      cascade: ["kokoro", "say-default"],
      providers: {
        kokoro: { togglePath: "~/.toggles/kokoro", summarizer: "broken" },
        "say-default": { summarizer: "canned" },
      },
      summarizers: { broken: {}, canned: {} },
    };
    const audio = await orchestrate({
      mode: "hook",
      ctx: { hookEvent: "Stop" },
      config: cfgWithThrowingTier,
      isToggleOn: onlyKokoro,
      runSummarizer: async (name) => {
        if (name === "broken") throw new Error("nope");
        return "fallback";
      },
      runProvider: async (_, text) => `/tmp/${text.length}.wav`,
    });
    expect(audio).toBe("/tmp/8.wav");
  });
});
