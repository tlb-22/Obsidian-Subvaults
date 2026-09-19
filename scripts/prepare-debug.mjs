/** 在固定测试 vault 中补充可重复使用的示例与滚动样本，已有文件保持原样。 */
import { mkdir, writeFile } from 'node:fs/promises';
import paths from './project-paths.cjs';
const root = paths.debugVault;
for (const folder of ['Projects/Alpha', 'Projects/Archive', 'Reading/Books', 'Journal', 'Testing/Long list']) await mkdir(`${root}/${folder}`, { recursive: true });
const files = {
  'Projects/Overview.md': '# Projects\n\nA shared vault, focused navigation.\n',
  'Projects/Alpha/Plan.md': '# Alpha\n\nSee [[Outside]] for a file outside this subvault.\n',
  'Projects/Alpha/Tasks.md': '# Tasks\n\n- [ ] Review the native file tree\n',
  'Reading/Books/Notes.md': '# Reading notes\n',
  'Outside.md': '# Outside\n\nThis file appears below the divider while open in another subvault.\n',
};
for (let i = 0; i < 160; i++) files[`Testing/Long list/Note ${String(i).padStart(3, '0')}.md`] = `# Note ${i}\n`;
for (const [path, content] of Object.entries(files)) {
  try { await writeFile(`${root}/${path}`, content, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
console.log('Debug fixtures ready.');
