/** 只将构建文件同步到固定测试 vault，保留已有插件数据和 vault 设置。 */
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import paths from './project-paths.cjs';

const { id } = JSON.parse(await readFile(join(paths.dist, 'manifest.json'), 'utf8'));
const target = join(paths.debugVault, '.obsidian/plugins', id);
await mkdir(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(join(paths.dist, file), join(target, file));
console.log(`Synced build to ${target}`);
