import { describe, expect, test } from "bun:test";
import { parseSlackUrl, pickSlackRef, slackKey, withSlackContext } from "./slack-link";

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
  const base = {
    prompt: "do the thing",
    clipboard: "",
    clipboardChanged: true,
    isScheduled: false,
  };
  const OTHER = "https://acme.slack.com/archives/C999/p1790663425161349";

  test("prompt link beats clipboard link", () => {
    const r = pickSlackRef({ ...base, prompt: `x ${EXAMPLE}`, clipboard: OTHER });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
    expect(r.fromClipboard).toBe(false);
  });

  test("freshly copied link is used when the prompt has none", () => {
    const r = pickSlackRef({ ...base, clipboard: `  ${EXAMPLE}\n` });
    expect(r.ref?.channelId).toBe("C0123ABCDEF");
    expect(r.fromClipboard).toBe(true);
  });

  test("unchanged clipboard is ignored", () => {
    expect(pickSlackRef({ ...base, clipboard: EXAMPLE, clipboardChanged: false }).ref).toBeNull();
  });

  test("prose that merely contains a link is ignored", () => {
    expect(pickSlackRef({ ...base, clipboard: `look at ${EXAMPLE}` }).ref).toBeNull();
  });

  test("!noclip skips the clipboard and is stripped", () => {
    const r = pickSlackRef({ ...base, prompt: "!noclip do the thing", clipboard: EXAMPLE });
    expect(r.ref).toBeNull();
    expect(r.prompt).toBe("do the thing");
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
