/** 检查版本化图片与单次捕获记录；不读取文件或调用截图宿主。 */
import { imageName, languages, newSubvault, scenes, type Language, type Scene } from './Scenarios';
import type { Observation } from './HostScene';

export interface ImageRecord {
  readonly scene: Scene;
  readonly language: Language['id'];
  readonly file: string;
  readonly sha256: string;
  readonly observation: Observation;
}
export interface CaptureRecord { readonly schema: 1; readonly version: string; readonly sourceDigest: string; readonly images: readonly ImageRecord[] }
export type ImageFact = { readonly kind: 'missing'; readonly file: string } | { readonly kind: 'present'; readonly file: string; readonly sha256: string };
export type ImageIssue = { readonly kind: 'version' | 'source' | 'image-set' } | { readonly kind: 'missing' | 'content' | 'language' | 'scene'; readonly file: string };

export function imageIssues(version: string, facts: readonly ImageFact[]): readonly ImageIssue[] {
  const issues: ImageIssue[] = [];
  for (const language of languages) for (const scene of scenes) {
    const file = imageName(scene, version, language.id), fact = facts.find(item => item.file === file);
    if (!fact || fact.kind === 'missing') issues.push({ kind: 'missing', file });
  }
  return issues;
}

export function captureIssues(version: string, sourceDigest: string, record: CaptureRecord, facts: readonly ImageFact[]): readonly ImageIssue[] {
  const issues: ImageIssue[] = [...imageIssues(version, facts)];
  if (record.version !== version) issues.push({ kind: 'version' });
  if (record.sourceDigest !== sourceDigest) issues.push({ kind: 'source' });
  const expected = languages.flatMap(language => scenes.map(scene => imageName(scene, version, language.id)));
  if (record.images.length !== expected.length || new Set(record.images.map(image => image.file)).size !== expected.length || record.images.some(image => !expected.includes(image.file))) issues.push({ kind: 'image-set' });
  for (const language of languages) for (const scene of scenes) {
    const file = imageName(scene, version, language.id), image = record.images.find(item => item.file === file), fact = facts.find(item => item.file === file);
    if (fact?.kind !== 'present') continue;
    if (!image || fact.sha256 !== image.sha256) issues.push({ kind: 'content', file });
    if (image && (image.language !== language.id || image.observation.language !== language.obsidian || image.observation.nativeNewNote !== language.newNote)) issues.push({ kind: 'language', file });
    if (image && (image.scene !== scene || !matchesScene(scene, image.observation))) issues.push({ kind: 'scene', file });
  }
  return issues;
}

function matchesScene(scene: Scene, { view }: Observation): boolean {
  if (scene === 'create') return view.kind === 'create' && view.folder === newSubvault.folder && view.icon === newSubvault.icon && view.color === newSubvault.color;
  return view.kind === 'navigation' && view.heading === (scene === 'all' ? 'All' : 'Research');
}

export function readmeReferences(content: string): readonly string[] { return content.match(/\.docs\/images\/(?:all|subvault|create)-[^\s"')/]+\.png/g) ?? []; }

export function readmeBlock(language: Language, version: string): string {
  const labels = language.id === 'en' ? ['All: learning, research, and leisure in one vault', 'Research subvault with an open file from Learning', 'Creating a Leisure subvault with an orange gamepad icon'] : ['All：在同一 vault 中组织学习、研究与娱乐', 'Research subvault：聚焦研究文件夹，并保留已打开的学习笔记', '为 Leisure 文件夹创建 subvault，使用橙色游戏手柄图标'];
  const headings = ['All', 'Research', language.id === 'en' ? 'Create a subvault' : '新建 subvault'];
  const images = scenes.map((scene, index) => `<img src=".docs/images/${imageName(scene, version, language.id)}" width="240" alt="${labels[index]}">`);
  const table = ['<table>', '  <tr>', ...headings.map(heading => `    <th width="33.33%">${heading}</th>`), '  </tr>', '  <tr>', ...images.map(image => `    <td>${image}</td>`), '  </tr>', '</table>'].join('\n');
  return ['<!-- screenshots:start -->', table, '<!-- screenshots:end -->'].join('\n\n');
}

export function updateReadme(content: string, language: Language, version: string): string {
  const block = readmeBlock(language, version), marker = /<!-- screenshots:start -->[\s\S]*?<!-- screenshots:end -->/g;
  const matches = content.match(marker) ?? [];
  if (matches.length === 1) return content.replace(marker, block);
  if (matches.length > 1 || content.includes('<!-- screenshots:')) throw new Error('README screenshot markers are incomplete or duplicated');
  const heading = language.id === 'en' ? '## Installation' : '## 安装';
  if (!content.includes(heading)) throw new Error(`Missing installation heading in ${language.readme}`);
  return content.replace(heading, `${block}\n\n${heading}`);
}
