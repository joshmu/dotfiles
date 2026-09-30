import { describe, expect, test } from "bun:test";
import { resolveLaunch } from "./launch";

const base = { default: "work", workspaces: {} } as any;
const work = { ...base, launch: { mux: "herdr", fixedCwd: "/w/project", focusOnLaunch: true } };

describe("resolveLaunch", () => {
  test("no launch block keeps today's behaviour", () => {
    expect(resolveLaunch(base, false)).toEqual({ mux: "tmux", fixedCwd: undefined, focus: false });
  });

  test("raycast prompts use the machine's launch block", () => {
    expect(resolveLaunch(work, false)).toEqual({
      mux: "herdr",
      fixedCwd: "/w/project",
      focus: true,
    });
  });

  test("scheduled prompts ignore it", () => {
    expect(resolveLaunch(work, true)).toEqual({ mux: "tmux", focus: false });
  });
});
