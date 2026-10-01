import { describe, expect, test } from "bun:test";
import {
  liveClipCopiedAt,
  parseFlags,
  parseSlackUrl,
  pickSlackRef,
  slackKey,
  withSlackContext,
} from "./slack-link";

const EXAMPLE = "https://acme.slack.com/archives/C0123ABCDEF/p1790663425161349";

describe("parseSlackUrl", () => {
  test("channel message inside a prompt", () => {
    const ref = parseSlackUrl(
      `appears emails validation requires new task to add to backlog ${EXAMPLE}`,
    );
    expect(ref).toEqual({
      url: EXAMPLE,
      host: "acme.slack.com",
      channelId: "C0123ABCDEF",
      ts: "1790663425.161349",
      threadTs: "1790663425.161349",
    });
  });

  test("thread reply carries thread_ts and cid", () => {
    const ref = parseSlackUrl(
      "https://acme.slack.com/archives/C0123ABCDEF/p1790663999000001?thread_ts=1790663425.161349&cid=C0123ABCDEF",
    );
    expect(ref?.ts).toBe("1790663999.000001");
    expect(ref?.threadTs).toBe("1790663425.161349");
    expect(ref?.channelId).toBe("C0123ABCDEF");
  });

  test("DM, group DM and legacy group ids", () => {
    expect(
      parseSlackUrl("https://acme.slack.com/archives/D0ABC123/p1790663425161349")?.channelId,
    ).toBe("D0ABC123");
    expect(parseSlackUrl("https://acme.slack.com/archives/G0ABC123")?.channelId).toBe("G0ABC123");
  });

  test("bare channel link has no ts", () => {
    const ref = parseSlackUrl("https://globex.slack.com/archives/C0456GHIJKL");
    expect(ref).toMatchObject({ host: "globex.slack.com", channelId: "C0456GHIJKL" });
    expect(ref?.ts).toBeUndefined();
  });

  test("trailing punctuation and angle brackets are not part of the url", () => {
    expect(parseSlackUrl(`see <${EXAMPLE}>.`)?.url).toBe(EXAMPLE);
    expect(parseSlackUrl(`see ${EXAMPLE}.`)?.url).toBe(EXAMPLE);
  });

  test("first link wins", () => {
    const other = "https://acme.slack.com/archives/C111/p1790663425161349";
    expect(parseSlackUrl(`${EXAMPLE} ${other}`)?.channelId).toBe("C0123ABCDEF");
  });

  test("app.slack.com client links, with and without a thread", () => {
    expect(parseSlackUrl("https://app.slack.com/client/T0123ABCD/C0123ABCDEF")).toMatchObject({
      teamId: "T0123ABCD",
      channelId: "C0123ABCDEF",
    });
    expect(
      parseSlackUrl(
        "https://app.slack.com/client/T0123ABCD/C0123ABCDEF/thread/C0123ABCDEF-1790663425.161349",
      )?.threadTs,
    ).toBe("1790663425.161349");
  });

  test("slack:// deep link", () => {
    expect(parseSlackUrl("slack://channel?team=T0123ABCD&id=C0123ABCDEF")).toMatchObject({
      teamId: "T0123ABCD",
      channelId: "C0123ABCDEF",
    });
  });

  test.each([
    "https://example.com/archives/C0123ABCDEF",
    "https://acme.slack.com/files/U123/F456/report.pdf",
    "https://acme.slack.com/docs/T0123ABCD/F0CANVAS",
    "no link here",
  ])("ignores %p", (text) => {
    expect(parseSlackUrl(text)).toBeNull();
  });
});

describe("slackKey", () => {
  test("host + channel, so repeat links to the same channel collapse", () => {
    const a = parseSlackUrl(EXAMPLE)!;
    const b = parseSlackUrl("https://acme.slack.com/archives/C0123ABCDEF/p1790669999000001")!;
    expect(slackKey(a)).toBe("acme.slack.com:C0123ABCDEF");
    expect(slackKey(b)).toBe(slackKey(a));
  });
});

describe("pickSlackRef", () => {
  const NOW = 1_000_000_000;
  const MIN = 60_000;
  const OTHER = "https://acme.slack.com/archives/C999/p1790663425161349";
  const clip = (text: string, changeCount: number, agoMs = 0) => ({
    text,
    changeCount,
    at: NOW - agoMs,
  });
  const base = {
    prompt: "do the thing",
    clips: [] as ReturnType<typeof clip>[],
    lastLaunchCount: 100,
    currentCount: 110,
    now: NOW,
    isScheduled: false,
  };

  test("prompt link beats clipboard link", () => {
    const r = pickSlackRef({ ...base, prompt: `x ${EXAMPLE}`, clips: [clip(OTHER, 110)] });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
    expect(r.fromClipboard).toBe(false);
  });

  test("freshly copied link on the live clipboard is used", () => {
    const r = pickSlackRef({ ...base, clips: [clip(`  ${EXAMPLE}\n`, 110)] });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
    expect(r.fromClipboard).toBe(true);
  });

  test("a recorded link survives later copies such as dictation", () => {
    const clips = [clip(EXAMPLE, 105, 20_000), clip("do the thing", 110)];
    expect(pickSlackRef({ ...base, clips }).ref?.channelId).toBe("C0123ABCDEF");
  });

  test("newest eligible link wins", () => {
    const clips = [clip(OTHER, 103, 2 * MIN), clip(EXAMPLE, 107, MIN), clip("text", 110)];
    expect(pickSlackRef({ ...base, clips }).ref?.channelId).toBe("C0123ABCDEF");
  });

  test("links copied before the last launch are ignored", () => {
    expect(pickSlackRef({ ...base, clips: [clip(EXAMPLE, 100)] }).ref).toBeNull();
  });

  test("links older than 10 minutes are ignored", () => {
    expect(pickSlackRef({ ...base, clips: [clip(EXAMPLE, 105, 11 * MIN)] }).ref).toBeNull();
  });

  test("first run and a counter reset after reboot both allow fresh links", () => {
    expect(
      pickSlackRef({ ...base, lastLaunchCount: null, clips: [clip(EXAMPLE, 5)] }).ref,
    ).not.toBeNull();
    expect(
      pickSlackRef({ ...base, lastLaunchCount: 900, currentCount: 12, clips: [clip(EXAMPLE, 10)] })
        .ref,
    ).not.toBeNull();
  });

  test("prose that merely contains a link is ignored", () => {
    expect(pickSlackRef({ ...base, clips: [clip(`look at ${EXAMPLE}`, 110)] }).ref).toBeNull();
  });

  test("a link already pasted into an agent since it was copied is ignored", () => {
    const clips = [clip(EXAMPLE, 105, MIN)];
    expect(pickSlackRef({ ...base, clips, alreadyPasted: () => true }).ref).toBeNull();
    expect(pickSlackRef({ ...base, clips, alreadyPasted: () => false }).ref).not.toBeNull();
  });

  test("an older unpasted link is used when the newest was already pasted", () => {
    const clips = [clip(OTHER, 103, 2 * MIN), clip(EXAMPLE, 107, MIN)];
    const pasted = (url: string) => url === EXAMPLE;
    expect(pickSlackRef({ ...base, clips, alreadyPasted: pasted }).ref?.channelId).toBe("C999");
  });

  test("commands are stripped and a clipboard link still applies with a target", () => {
    const r = pickSlackRef({
      ...base,
      prompt: ":slak :new do the thing",
      clips: [clip(EXAMPLE, 110)],
    });
    expect(r).toMatchObject({ prompt: "do the thing", target: "slak", fresh: true });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
  });

  test("scheduled prompts never pick a Slack ref", () => {
    expect(pickSlackRef({ ...base, prompt: `x ${EXAMPLE}`, isScheduled: true }).ref).toBeNull();
  });
});

describe("withSlackContext", () => {
  test("names the MCP server, channel and thread", () => {
    const out = withSlackContext("fix it", parseSlackUrl(EXAMPLE)!, "slack-acme");
    expect(out).toContain("slack-acme");
    expect(out).toContain("C0123ABCDEF");
    expect(out).toContain("thread_ts 1790663425.161349");
    expect(out.endsWith("fix it")).toBe(true);
  });
});

describe("parseFlags", () => {
  test.each([
    [":new fix it", "fix it", true, undefined],
    [":slak fix it", "fix it", false, "slak"],
    [":new :platform-team fix it", "fix it", true, "platform-team"],
    ["  :SLAK   fix it\nsecond line", "fix it\nsecond line", false, "slak"],
    [":slak :other fix it", "fix it", false, "slak"],
    ["fix :slak it", "fix :slak it", false, undefined],
    [":) hello", ":) hello", false, undefined],
    ["no commands", "no commands", false, undefined],
  ])("%p", (input, prompt, fresh, target) => {
    expect(parseFlags(input)).toEqual({ prompt, fresh, target });
  });
});

describe("liveClipCopiedAt", () => {
  const NOW = 1_000_000_000;
  test("no earlier than the last launch, no older than the freshness window", () => {
    expect(liveClipCopiedAt(NOW - 60_000, NOW)).toBe(NOW - 60_000);
    expect(liveClipCopiedAt(NOW - 3_600_000, NOW)).toBe(NOW - 10 * 60_000);
    expect(liveClipCopiedAt(null, NOW)).toBe(NOW - 10 * 60_000);
  });
});
