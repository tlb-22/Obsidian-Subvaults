/** 构建后执行：准备截图 vault，逐语言捕获真实场景，完整验证后发布 README 图片。 */
import { build } from 'esbuild';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import paths from './project-paths.cjs';
import createArtifactRun from './artifact-run.cjs';
import { prepareVault, type CaptureManifest } from './screenshots/ScreenshotVault';
import { withObsidian, waitFor } from './screenshots/ObsidianApp';
import { imageName, languages, scenes, viewport } from './screenshots/Scenarios';
import { digest, publishImages, sourceDigest } from './screenshots/ImageFiles';
import type { CaptureRecord, ImageRecord } from './screenshots/ImageRules';
import type { Observation, SceneRequest } from './screenshots/HostScene';

async function capture(): Promise<void> {
  if (process.argv.length !== 2) throw new Error('Usage: npm run screenshots');
  const locks = join(paths.scratch, 'probes');
  await mkdir(locks, { recursive: true });
  const lockPath = join(locks, 'readme-capture.lock');
  const lock = await open(lockPath, 'wx');
  try {
    const manifest = JSON.parse(await readFile(join(paths.dist, 'manifest.json'), 'utf8')) as CaptureManifest;
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Screenshot filenames require a three-part plugin version');
    if (await readFile(join(paths.dist, 'manifest.json'), 'utf8') !== await readFile(join(paths.project, 'manifest.json'), 'utf8')) throw new Error('Build manifest differs from the project. Run npm run screenshots.');
    const source = await sourceDigest(paths.project);
    const { name, directories } = createArtifactRun('readme-capture', ['tests', 'logs', 'previews']);
    console.log(`Screenshot run: ${name}`);
    console.log(`Logs: ${relative(paths.project, directories.logs)}`);
    const vault = await prepareVault(paths.screenshotVault, paths.dist, manifest);
    const host = await build({ absWorkingDir: paths.project, entryPoints: ['scripts/screenshots/HostScene.ts'], bundle: true, platform: 'browser', target: 'es2022', format: 'iife', globalName: 'ScreenshotHost', write: false });
    const bundle = host.outputFiles[0]!.text;
    const images: ImageRecord[] = [];
    for (const language of languages) {
      console.log(`Capturing ${language.id} in the isolated screenshot vault…`);
      await withObsidian(join(directories.tests, language.id), join(directories.logs, `${language.id}.log`), vault, language, async client => {
        await waitFor(async () => await client.evaluate<boolean>('typeof app !== "undefined" && !!app.workspace') ? true : undefined, 'Screenshot workspace did not initialize');
        const actualVault = await client.evaluate<string>('app.vault.adapter.getBasePath()');
        if (actualVault !== vault) throw new Error('Refusing to operate on a different vault');
        await client.evaluate(`(async () => { localStorage.setItem('language', ${JSON.stringify(language.obsidian)}); await app.plugins.setEnable(true); })()`);
        await client.reload();
        await waitFor(async () => await client.evaluate<boolean>(`typeof app !== 'undefined' && document.documentElement.lang === ${JSON.stringify(language.obsidian)} && !!app.workspace`) ? true : undefined, 'Screenshot language did not initialize');
        await client.size(viewport.width, viewport.height, viewport.scale);
        await client.evaluate(bundle);
        for (const scene of scenes) {
          const request: SceneRequest = { vault, pluginId: manifest.id, version: manifest.version, language: language.obsidian, newNote: language.newNote, scene };
          const observation = await client.evaluate<Observation>(`ScreenshotHost.prepare(${JSON.stringify(request)})`);
          const bytes = await client.screenshot(), file = imageName(scene, manifest.version, language.id);
          await writeFile(join(directories.previews, file), bytes);
          images.push({ scene, language: language.id, file, sha256: digest(bytes), observation });
        }
      });
    }
    const record: CaptureRecord = { schema: 1, version: manifest.version, sourceDigest: source, images };
    await writeFile(join(directories.previews, 'screenshots.json'), JSON.stringify(record, null, 2) + '\n');
    await publishImages(paths.project, paths.readmeImages, directories.previews, record);
    console.log(`Source screenshots: ${relative(paths.project, directories.previews)}`);
  } finally { await lock.close(); await unlink(lockPath); }
}

capture().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
