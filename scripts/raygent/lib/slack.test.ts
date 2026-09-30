import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { authHeaders, conversationLabel, resolveLabel, workspaceFor } from "./slack";

const cfg = {
  workspaces: {
    "acme.slack.com": { mcpServer: "slack-acme", teamId: "T0123ABCD" },
    "globex.slack.com": { mcpServer: "slack-globex" },
  },
};

function fakeSlack(responses: Record<string, any>) {
  const calls: string[] = [];
  const call = async (method: string, params: Record<string, string>) => {
    calls.push(method);
    const r = responses[method];
    if (!r) throw new Error(`slack ${method}: channel_not_found`);
    return typeof r === "function" ? r(params) : r;
  };
  return { call, calls };
}

describe("workspaceFor", () => {
  test("maps the link host to its workspace settings", () => {
    expect(workspaceFor({ url: "", host: "acme.slack.com", channelId: "C1" }, cfg)?.mcpServer).toBe(
      "slack-acme",
    );
    expect(
      workspaceFor({ url: "", host: "globex.slack.com", channelId: "C1" }, cfg)?.mcpServer,
    ).toBe("slack-globex");
  });

  test("falls back to team id for app.slack.com links", () => {
    expect(workspaceFor({ url: "", teamId: "T0123ABCD", channelId: "C1" }, cfg)?.mcpServer).toBe(
      "slack-acme",
    );
  });

  test("unknown host or no config", () => {
    expect(
      workspaceFor({ url: "", host: "other.slack.com", channelId: "C1" }, cfg),
    ).toBeUndefined();
    expect(
      workspaceFor({ url: "", host: "acme.slack.com", channelId: "C1" }, undefined),
    ).toBeUndefined();
  });
});

describe("authHeaders", () => {
  test("parses the command's JSON header object", () => {
    expect(authHeaders(`echo '{"Authorization":"Bearer t-1"}'`)).toEqual({
      Authorization: "Bearer t-1",
    });
  });

  test.each([
    ["failing command", "exit 3"],
    ["non-JSON output", "echo nope"],
    ["empty header value", `echo '{"Authorization":""}'`],
    ["array output", `echo '["Bearer t"]'`],
  ])("rejects %s", (_label, command) => {
    expect(authHeaders(command)).toBeNull();
  });
});

describe("conversationLabel", () => {
  test("channel uses its name", async () => {
    const { call } = fakeSlack({
      "conversations.info": { channel: { name: "platform-team" } },
    });
    expect(await conversationLabel("C0123ABCDEF", call)).toBe("platform-team");
  });

  test("1:1 DM uses the other person's display name", async () => {
    const { call } = fakeSlack({
      "conversations.info": { channel: { is_im: true, user: "U1" } },
      "users.info": { user: { name: "jane.doe", profile: { display_name: "Jane" } } },
    });
    expect(await conversationLabel("D1", call)).toBe("dm-Jane");
  });

  test("group DM lists the other members", async () => {
    const { call } = fakeSlack({
      "conversations.info": { channel: { is_mpim: true, name: "mpdm-alex--ana--ben-1" } },
      "auth.test": { user: "alex" },
    });
    expect(await conversationLabel("C2", call)).toBe("gdm-ana-ben");
  });
});

describe("resolveLabel", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raygent-slack-"));
    process.env.RAYGENT_STATE_DIR = dir;
  });
  afterEach(() => {
    delete process.env.RAYGENT_STATE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });
  const ref = { url: "", host: "acme.slack.com", channelId: "C0123ABCDEF" };

  test("looks up once, then serves from cache", async () => {
    const { call, calls } = fakeSlack({
      "conversations.info": { channel: { name: "platform-team" } },
    });
    expect(await resolveLabel("k", ref, cfg, call, 1000)).toBe("platform-team");
    expect(await resolveLabel("k", ref, cfg, call, 2000)).toBe("platform-team");
    expect(calls).toEqual(["conversations.info"]);
  });

  test("expired cache entries are refreshed", async () => {
    const { call, calls } = fakeSlack({ "conversations.info": { channel: { name: "renamed" } } });
    await resolveLabel("k", ref, cfg, call, 0);
    expect(await resolveLabel("k", ref, cfg, call, 8 * 24 * 3600 * 1000)).toBe("renamed");
    expect(calls.length).toBe(2);
  });

  test("API failure returns null", async () => {
    const { call } = fakeSlack({});
    expect(await resolveLabel("k", ref, cfg, call)).toBeNull();
  });

  test("no auth command configured returns null without calling Slack", async () => {
    expect(await resolveLabel("k", ref, cfg)).toBeNull();
  });
});
