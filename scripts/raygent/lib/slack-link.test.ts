import { describe, expect, test } from "bun:test";
import {
  latestClipboardRef,
  parseFlags,
  parseSlackUrl,
  pickSlackRef,
  slackKey,
  withSlackContext,
  type Mod,
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
  const OTHER = "https://acme.slack.com/archives/C999/p1790663425161349";
  const watched = (text: string, at: number) => ({ text, changeCount: 0, at });
  const pick = (prompt: string, live = "", clips: ReturnType<typeof watched>[] = []) => {
    let reads = 0;
    const r = pickSlackRef({
      prompt,
      clipboard: () => {
        reads++;
        return { live, watched: clips };
      },
      isScheduled: false,
    });
    return { ...r, reads };
  };

  test("without s the clipboard is never read, even with a Slack link on it", () => {
    const r = pick("can you go look at xyz", EXAMPLE, [watched(OTHER, 1)]);
    expect(r).toMatchObject({ ref: null, mods: [], prompt: "can you go look at xyz", reads: 0 });
  });

  test("s: generic prompt bound to the copied link", () => {
    const r = pick("s can you go look at xyz", EXAMPLE);
    expect(r).toMatchObject({
      fromClipboard: true,
      mods: ["slack"],
      prompt: "can you go look at xyz",
    });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
    expect(r.target).toBeUndefined();
  });

  test("s :agent: agent send carrying the copied link", () => {
    const r = pick("s :fe-ai can you go look at xyz", EXAMPLE);
    expect(r).toMatchObject({
      target: "fe-ai",
      fromClipboard: true,
      prompt: "can you go look at xyz",
    });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
  });

  test("s :new :agent and s :new parse alongside the mod", () => {
    expect(pick("s :new fix it", EXAMPLE)).toMatchObject({ fresh: true, prompt: "fix it" });
    expect(pick("s :new :fe-ai fix it", EXAMPLE)).toMatchObject({ fresh: true, target: "fe-ai" });
  });

  test("most recent link: live clipboard first, else the newest clip-watch record", () => {
    expect(pick("s x", OTHER, [watched(EXAMPLE, 9)]).ref?.channelId).toBe("C999");
    const clips = [watched(OTHER, 1), watched(EXAMPLE, 3), watched(OTHER, 2)];
    expect(pick("s x", "dictated text", clips).ref?.channelId).toBe("C0123ABCDEF");
  });

  test("s with no Slack link copied picks nothing but keeps the mod", () => {
    expect(pick("s fix it", "plain text")).toMatchObject({ ref: null, mods: ["slack"] });
  });

  test("a link typed in the prompt binds without s and beats the clipboard with s", () => {
    expect(pick(`x ${EXAMPLE}`, OTHER)).toMatchObject({ fromClipboard: false, reads: 0 });
    expect(pick(`x ${EXAMPLE}`).ref?.channelId).toBe("C0123ABCDEF");
    expect(pick(`s x ${EXAMPLE}`, OTHER).ref?.channelId).toBe("C0123ABCDEF");
  });

  test("an agent send without s goes as typed: no Slack binding from clipboard or prompt", () => {
    const r = pick(`:slak :new do the thing ${EXAMPLE}`, OTHER);
    expect(r).toMatchObject({ prompt: `do the thing ${EXAMPLE}`, target: "slak", fresh: true });
    expect(r.ref).toBeNull();
    expect(r.reads).toBe(0);
  });

  test("s is only a mod as an exact lowercase first token", () => {
    for (const p of ["S fix it", "s3 bucket policy", "fix s it", ":fe-ai s fix it"])
      expect(pick(p, EXAMPLE)).toMatchObject({ mods: [], reads: 0 });
  });

  test("scheduled prompts never pick a Slack ref", () => {
    const r = pickSlackRef({
      prompt: `s x ${EXAMPLE}`,
      clipboard: () => ({ live: EXAMPLE, watched: [] }),
      isScheduled: true,
    });
    expect(r.ref).toBeNull();
  });
});

describe("latestClipboardRef", () => {
  test("a link inside copied text still counts; nothing copied is null", () => {
    expect(latestClipboardRef({ live: `see ${EXAMPLE}`, watched: [] })?.channelId).toBe(
      "C0123ABCDEF",
    );
    expect(latestClipboardRef({ live: "", watched: [] })).toBeNull();
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
    [":new fix it", "fix it", [], true, undefined],
    [":slak fix it", "fix it", [], false, "slak"],
    [":new :platform-team fix it", "fix it", [], true, "platform-team"],
    ["  :SLAK   fix it\nsecond line", "fix it\nsecond line", [], false, "slak"],
    [":slak :other fix it", "fix it", [], false, "slak"],
    ["fix :slak it", "fix :slak it", [], false, undefined],
    [":) hello", ":) hello", [], false, undefined],
    ["no commands", "no commands", [], false, undefined],
    ["s can you go look at xyz", "can you go look at xyz", ["slack"], false, undefined],
    ["s :fe-ai :new fix it", "fix it", ["slack"], true, "fe-ai"],
    ["s", "", ["slack"], false, undefined],
    ["S fix it", "S fix it", [], false, undefined],
    ["s3 fix it", "s3 fix it", [], false, undefined],
    [":fe-ai s fix it", "s fix it", [], false, "fe-ai"],
  ] as [string, string, Mod[], boolean, string | undefined][])(
    "%p",
    (input, prompt, mods, fresh, target) => {
      expect(parseFlags(input)).toEqual({ prompt, mods, fresh, target });
    },
  );
});
