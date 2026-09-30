import { RAYCAST_WORKSPACE_LABEL, SLACK_WORKSPACE_LABEL } from "./herdr";
import type { Config } from "./router-agent";

export interface LaunchPlan {
  mux: "herdr" | "tmux";
  fixedCwd?: string;
  focus: boolean;
}

/** Herdr workspace for a Raycast launch. */
export function launchWorkspace(hasSlackContext: boolean): string {
  return hasSlackContext ? SLACK_WORKSPACE_LABEL : RAYCAST_WORKSPACE_LABEL;
}

/** Per-machine launch settings apply to Raycast prompts only; scheduled runs keep their own routing. */
export function resolveLaunch(cfg: Config, isScheduled: boolean): LaunchPlan {
  if (isScheduled) return { mux: "tmux", focus: false };
  const l = cfg.launch ?? {};
  return { mux: l.mux ?? "tmux", fixedCwd: l.fixedCwd, focus: l.focusOnLaunch ?? false };
}
