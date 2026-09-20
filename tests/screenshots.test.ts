/** 检查截图过期判定与专用 vault 的写入边界，无需启动 Obsidian。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureIssues, imageIssues, readmeReferences, updateReadme, type CaptureRecord, type ImageFact } from '../scripts/screenshots/ImageRules';
import { imageName, languages, newSubvault, scenes } from '../scripts/screenshots/Scenarios';
import { prepareVault } from '../scripts/screenshots/ScreenshotVault';

const record: CaptureRecord = {
  schema: 1, version: '0.1.0', sourceDigest: 'current-source',
  images: languages.flatMap(language => scenes.map(scene => ({
    scene, language: language.id, file: imageName(scene, '0.1.0', language.id), sha256: `${scene}-${language.id}`,
    observation: {
      language: language.obsidian, nativeNewNote: language.newNote, hostVersion: '1.13.7', area: { x: 44, y: 80, width: 280, height: 400 },
      view: scene === 'create' ? { kind: 'create' as const, ...newSubvault } : { kind: 'navigation' as const, heading: scene === 'all' ? 'All' : 'Research', roots: [], externalFiles: [] },
    },
  }))),
};
const facts: readonly ImageFact[] = record.images.map(image => ({ kind: 'present', file: image.file, sha256: image.sha256 }));

test('capture validation rejects source changes, altered images, incorrect languages and creation selections', () => {
  assert.deepEqual(captureIssues('0.1.0', 'current-source', record, facts), []);
  assert.ok(captureIssues('0.2.0', 'current-source', record, facts).some(issue => issue.kind === 'version'));
  assert.deepEqual(captureIssues('0.1.0', 'new-source', record, facts), [{ kind: 'source' }]);
  assert.deepEqual(imageIssues('0.1.0', facts), []);
  assert.equal(imageIssues('0.2.0', facts).filter(issue => issue.kind === 'missing').length, 6);
  const first = facts[0]!;
  assert.deepEqual(captureIssues('0.1.0', 'current-source', record, [{ kind: 'missing', file: first.file }, ...facts.slice(1)]), [{ kind: 'missing', file: first.file }]);
  assert.ok(captureIssues('0.1.0', 'current-source', record, [{ ...first, kind: 'present', sha256: 'changed' }, ...facts.slice(1)]).some(issue => issue.kind === 'content'));
  const wrongLocale: CaptureRecord = { ...record, images: record.images.map(image => ({ ...image, observation: { ...image.observation, language: 'en' } })) };
  assert.equal(captureIssues('0.1.0', 'current-source', wrongLocale, facts).filter(issue => issue.kind === 'language').length, 3);
  const wrongFolder: CaptureRecord = { ...record, images: record.images.map(image => image.observation.view.kind === 'create' ? { ...image, observation: { ...image.observation, view: { ...image.observation.view, folder: 'Research' } } } : image) };
  assert.equal(captureIssues('0.1.0', 'current-source', wrongFolder, facts).filter(issue => issue.kind === 'scene').length, 2);
});

test('README image updates keep surrounding prose and replace the complete localized versioned block', () => {
  for (const language of languages) {
    const heading = language.id === 'en' ? '## Installation' : '## 安装';
    const input = `# Subvaults\n\nIntroduction.\n\n${heading}\n\nInstall here.\n`;
    const once = updateReadme(input, language, '0.1.0'), updated = updateReadme(once, language, '0.2.0');
    assert.ok(updated.startsWith('# Subvaults\n\nIntroduction.\n\n'));
    assert.ok(updated.endsWith(`${heading}\n\nInstall here.\n`));
    assert.deepEqual(readmeReferences(updated), scenes.map(scene => `.docs/images/${imageName(scene, '0.2.0', language.id)}`));
    assert.match(updated, /<table>[\s\S]*<\/table>/);
    assert.equal(updateReadme(updated, language, '0.2.0'), updated);
    assert.throws(() => updateReadme(`${input}\n<!-- screenshots:start -->`, language, '0.1.0'), /incomplete/);
  }
});

test('screenshot preparation refuses an existing unmarked vault without changing its notes', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'subvaults-screenshot-boundary-'));
  try {
    await writeFile(join(vault, 'Personal.md'), 'Keep this note.');
    await assert.rejects(prepareVault(vault, join(vault, 'unused-dist'), { id: 'subvaults', name: 'Subvaults', version: '0.1.0', minAppVersion: '1.13.7' }));
    assert.equal(await readFile(join(vault, 'Personal.md'), 'utf8'), 'Keep this note.');
  } finally { await rm(vault, { recursive: true, force: true }); }
});
