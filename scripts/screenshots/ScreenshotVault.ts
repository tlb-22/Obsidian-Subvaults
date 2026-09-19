/** 重建明确归属本工具的截图 vault；工作区、插件配置与笔记均来自固定样例。 */
import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { activeNote, externalNote, notes, pluginData, vaultMarker } from './Scenarios';

export interface CaptureManifest { readonly id: string; readonly name: string; readonly version: string; readonly minAppVersion: string }
export async function prepareVault(vault: string, dist: string, manifest: CaptureManifest): Promise<string> {
  let exists = true;
  try {
    const info = await lstat(vault);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Screenshot vault must be a real directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    exists = false;
  }
  if (exists) {
    if (await readFile(join(vault, '.subvaults-screenshot-vault'), 'utf8') !== vaultMarker) throw new Error('Refusing to overwrite a vault not owned by the screenshot tool');
    await rm(vault, { recursive: true });
  }
  const plugin = join(vault, '.obsidian/plugins', manifest.id);
  await mkdir(plugin, { recursive: true });
  await writeFile(join(vault, '.subvaults-screenshot-vault'), vaultMarker);
  const json = async (name: string, value: unknown) => writeFile(join(vault, name), JSON.stringify(value, null, 2));
  for (const note of notes) {
    await mkdir(dirname(join(vault, note.path)), { recursive: true });
    await writeFile(join(vault, note.path), note.content);
  }
  for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(join(dist, file), join(plugin, file));
  await json(`.obsidian/plugins/${manifest.id}/data.json`, pluginData);
  await json('.obsidian/community-plugins.json', [manifest.id]);
  await json('.obsidian/core-plugins.json', ['file-explorer', 'global-search', 'switcher', 'command-palette', 'word-count']);
  await json('.obsidian/appearance.json', { theme: 'moonstone', baseFontSize: 16 });
  await json('.obsidian/app.json', { showInlineTitle: true, readableLineLength: true, spellcheck: false });
  const markdown = (id: string, file: string) => ({ id, type: 'leaf', state: { type: 'markdown', state: { file, mode: 'preview' } } });
  await json('.obsidian/workspace.json', {
    main: { id: 'main', type: 'split', direction: 'vertical', children: [{ id: 'notes', type: 'tabs', currentTab: 1, children: [markdown('reading-plan', externalNote), markdown('research-note', activeNote)] }] },
    left: { id: 'left', type: 'split', direction: 'horizontal', width: 280, children: [{ id: 'navigation', type: 'tabs', children: [
      { id: 'files', type: 'leaf', state: { type: 'file-explorer', state: { sortOrder: 'alphabetical', autoReveal: false } } },
      { id: 'search', type: 'leaf', state: { type: 'search', state: { query: '' } } },
    ] }] },
    right: { id: 'right', type: 'split', direction: 'horizontal', width: 240, collapsed: true, children: [] },
    active: 'research-note', lastOpenFiles: [activeNote, externalNote],
  });
  return realpath(vault);
}
