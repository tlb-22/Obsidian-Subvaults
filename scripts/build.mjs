/** 编译插件入口并将可安装文件集中输出到 dist，开发监听复用同一配置。 */
import { build, context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import paths from './project-paths.cjs';

await mkdir(paths.dist, { recursive: true });
await copyFile(join(paths.project, 'manifest.json'), join(paths.dist, 'manifest.json'));
await copyFile(join(paths.project, 'src/styles.css'), join(paths.dist, 'styles.css'));
const options = {
  absWorkingDir: paths.project,
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  platform: 'browser', format: 'cjs', target: 'es2022', outfile: 'dist/main.js',
  sourcemap: 'inline', logLevel: 'info',
};
if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
