import type { Config } from "./router-agent";

export interface LaunchPlan {
  mux: "herdr" | "tmux";
  fixedCwd?: string;
  focus: boolean;
}

/** Per-machine launch settings apply to Raycast prompts only; scheduled runs keep their own routing. */
export function resolveLaunch(cfg: Config, isScheduled: boolean): LaunchPlan {
  if (isScheduled) return { mux: "tmux", focus: false };
  const l = cfg.launch ?? {};
  return { mux: l.mux ?? "tmux", fixedCwd: l.fixedCwd, focus: l.focusOnLaunch ?? false };
}
