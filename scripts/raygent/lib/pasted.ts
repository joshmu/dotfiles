import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { projectsDir } from "./slack-sessions";

/**
 * True when `url` appears in a Claude session transcript written since `sinceMs`,
 * i.e. it was already pasted into (or launched with) an agent. Only top-level
 * session transcripts modified since then are read, so the cost tracks recent
 * activity (~90 ms for ~50 MB), not total history.
 */
export function pastedSince(url: string, sinceMs: number, root = projectsDir()): boolean {
  if (!existsSync(root)) return false;
  for (const dir of readdirSync(root)) {
    let files: string[];
    try {
      files = readdirSync(join(root, dir));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const p = join(root, dir, f);
      try {
        if (statSync(p).mtimeMs < sinceMs) continue;
        if (readFileSync(p, "utf8").includes(url)) return true;
      } catch {}
    }
  }
  return false;
}
