/** 用独立 userData 启动已安装的 macOS Obsidian；只管理本次创建的进程和调试连接。 */
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFile, mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { DevTools } from './DevTools';
import type { Language } from './Scenarios';

export async function waitFor<T>(read: () => Promise<T | undefined>, message: string, timeout = 30_000): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (value !== undefined) return value; await delay(100); }
  throw new Error(message);
}

async function stop(child: ChildProcess, exited: Promise<void>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}

export async function withObsidian<T>(profile: string, logPath: string, vault: string, language: Language, action: (client: DevTools) => Promise<T>): Promise<T> {
  if (process.platform !== 'darwin') throw new Error('Screenshot capture currently supports macOS; image checks run on any platform');
  const executable = process.env.SUBVAULTS_OBSIDIAN_EXECUTABLE ?? '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
  const installedProfile = process.env.SUBVAULTS_OBSIDIAN_PROFILE ?? join(homedir(), 'Library/Application Support/obsidian');
  await mkdir(profile, { recursive: true });
  const archives = (await readdir(installedProfile)).filter(name => /^obsidian-\d+\.\d+\.\d+\.asar$/.test(name));
  archives.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const latest = archives.at(-1);
  if (latest) await copyFile(join(installedProfile, latest), join(profile, basename(latest)));
  const vaultId = '73637265656e0001';
  await writeFile(join(profile, 'obsidian.json'), JSON.stringify({ vaults: { [vaultId]: { path: vault, ts: 1, open: true } }, language: language.obsidian, updateDisabled: true }));
  await writeFile(join(profile, `${vaultId}.json`), '{}');
  const log = await open(logPath, 'w');
  const child = spawn(executable, [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--disable-renderer-backgrounding'], { stdio: ['ignore', log.fd, log.fd] });
  let failure: Error | undefined;
  child.once('error', error => { failure = error; });
  const exited = new Promise<void>(resolve => { child.once('exit', () => resolve()); child.once('error', () => resolve()); });
  const interrupt = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let client: DevTools | undefined;
  try {
    const port = await waitFor(async () => {
      if (failure) throw failure;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Screenshot Obsidian exited during startup; see ${logPath}`);
      try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] || undefined; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    }, 'Screenshot Obsidian did not expose its debugging port');
    const endpoint = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) });
      const pages = await response.json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
      return pages.find(page => page.type === 'page' && page.url === 'app://obsidian.md/index.html')?.webSocketDebuggerUrl;
    }, 'Screenshot vault did not open');
    client = await DevTools.connect(endpoint);
    return await action(client);
  } finally {
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
    client?.close();
    await stop(child, exited);
    await log.close();
  }
}
