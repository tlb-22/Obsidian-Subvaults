/** 维护截图文件、可移植的源码摘要和 README 引用，供捕获与无界面检查共用。 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { imageName, languages, scenes } from './Scenarios';
import { captureIssues, imageIssues, readmeReferences, updateReadme, type CaptureRecord, type ImageFact } from './ImageRules';

export function digest(bytes: Uint8Array | string): string { return createHash('sha256').update(bytes).digest('hex'); }
export async function sourceDigest(project: string): Promise<string> {
  const files = ['manifest.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'scripts/build.mjs', 'scripts/project-paths.cjs', 'scripts/artifact-run.cjs', 'scripts/capture-readme-images.ts', 'scripts/check-readme-images.ts'];
  const collect = async (directory: string): Promise<void> => {
    for (const entry of await readdir(join(project, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await collect(name);
      else if (entry.isFile()) files.push(name);
      else throw new Error(`Screenshot source must be a regular file: ${name}`);
    }
  };
  await collect('src'); await collect('scripts/screenshots');
  const hash = createHash('sha256');
  for (const file of files.sort()) { hash.update(file); hash.update('\0'); hash.update(await readFile(join(project, file))); hash.update('\0'); }
  return hash.digest('hex');
}

export async function imageFacts(directory: string, version: string): Promise<readonly ImageFact[]> {
  const facts: ImageFact[] = [];
  for (const language of languages) for (const scene of scenes) {
    const file = imageName(scene, version, language.id);
    try { facts.push({ kind: 'present', file, sha256: digest(await readFile(join(directory, file))) }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; facts.push({ kind: 'missing', file }); }
  }
  return facts;
}

export async function checkReadmeImages(project: string, directory: string): Promise<string> {
  const { version } = JSON.parse(await readFile(join(project, 'manifest.json'), 'utf8')) as { version: string };
  const issues = imageIssues(version, await imageFacts(directory, version));
  if (issues.length) throw new Error(`README screenshots are stale or invalid: ${JSON.stringify(issues)}. Run npm run screenshots.`);
  for (const language of languages) {
    const references = readmeReferences(await readFile(join(project, language.readme), 'utf8'));
    const expected = scenes.map(scene => `.docs/images/${imageName(scene, version, language.id)}`);
    if (JSON.stringify(references) !== JSON.stringify(expected)) throw new Error(`${language.readme} must reference exactly the current ${language.id} screenshots. Run npm run screenshots.`);
  }
  return version;
}

export async function publishImages(project: string, directory: string, staging: string, record: CaptureRecord): Promise<void> {
  const issues = captureIssues(record.version, await sourceDigest(project), record, await imageFacts(staging, record.version));
  if (issues.length) throw new Error(`Capture did not produce a complete current image set: ${JSON.stringify(issues)}`);
  const readmes = await Promise.all(languages.map(async language => ({ path: join(project, language.readme), content: updateReadme(await readFile(join(project, language.readme), 'utf8'), language, record.version) })));
  await mkdir(directory, { recursive: true });
  for (const image of record.images) {
    const target = join(directory, image.file), temporary = `${target}.tmp`;
    await copyFile(join(staging, image.file), temporary); await rename(temporary, target);
  }
  for (const readme of readmes) await writeFile(readme.path, readme.content);
  await checkReadmeImages(project, directory);
  const keep = new Set(record.images.map(image => image.file));
  for (const file of await readdir(directory)) if (/^(all|subvault)-v\d+\.\d+\.\d+-(en|zh-Hans)\.png$/.test(file) && !keep.has(file)) await unlink(join(directory, file));
  console.log(`Updated ${relative(project, directory)} and both README files.`);
}
