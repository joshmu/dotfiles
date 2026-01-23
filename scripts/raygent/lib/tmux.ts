function hasSession(name: string): boolean {
  return Bun.spawnSync(['tmux', 'has-session', '-t', name]).exitCode === 0;
}

export function createSession(name: string, cwd?: string): void {
  const args = ['tmux', 'new-session', '-d', '-s', name];
  if (cwd) args.push('-c', cwd);

  if (Bun.spawnSync(args).exitCode !== 0) {
    throw new Error(`Failed to create tmux session: ${name}`);
  }
}

export function sendKeys(session: string, keys: string): void {
  if (Bun.spawnSync(['tmux', 'send-keys', '-t', session, keys, 'Enter']).exitCode !== 0) {
    throw new Error(`Failed to send keys to session: ${session}`);
  }
}

export function generateUniqueName(baseName: string): string {
  if (!hasSession(baseName)) return baseName;

  let counter = 1;
  while (hasSession(`${baseName}-${counter}`)) counter++;
  return `${baseName}-${counter}`;
}
