/** 校验发布标签与已构建版本，生成三个安装文件及同内容的 ZIP。 */
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import paths from './project-paths.cjs';

async function packageRelease() {
  const tag = process.argv[2];
  if (process.argv.length !== 3 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw new Error('Usage: npm run package:release -- <x.y.z>');
  const manifestText = await readFile(join(paths.project, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const metadata = JSON.parse(await readFile(join(paths.project, 'package.json'), 'utf8'));
  if (tag !== manifest.version || tag !== metadata.version) throw new Error('Release tag, manifest.json and package.json versions must match');
  if (await readFile(join(paths.dist, 'manifest.json'), 'utf8') !== manifestText) throw new Error('Build manifest differs from the project. Run npm run build.');

  const releases = join(paths.artifacts, 'releases');
  await mkdir(releases, { recursive: true });
  const output = join(releases, tag);
  await mkdir(output);
  const files = ['main.js', 'manifest.json', 'styles.css'];
  for (const file of files) await copyFile(join(paths.dist, file), join(output, file));
  execFileSync('zip', ['-j', '-q', join(output, `${manifest.id}-${tag}.zip`), ...files.map(file => join(output, file))]);
  console.log(`Release files: ${relative(paths.project, output)}`);
}

packageRelease().catch(error => { console.error(error.message); process.exitCode = 1; });
