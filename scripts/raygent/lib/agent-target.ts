import { homedir } from "os";
import { join } from "path";

const PICKER = join(import.meta.dir, "..", "..", "herdr-agent-picker", "index.ts");

/**
 * The pane the Herdr agent picker ranks first for `query` (same rows, order and
 * fuzzy matching as the ⌘P picker), or null when nothing matches.
 */
export function matchAgent(query: string): string | null {
  const session = process.env.RAYGENT_HERDR_SESSION;
  const env = session
    ? {
        ...process.env,
        HERDR_SOCKET_PATH: join(homedir(), ".config", "herdr", "sessions", session, "herdr.sock"),
      }
    : process.env;
  const r = Bun.spawnSync([process.execPath, PICKER, "--match", query], { env });
  const pane = r.stdout.toString().trim();
  return r.exitCode === 0 && pane ? pane : null;
}
