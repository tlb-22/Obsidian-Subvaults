/** README 截图的固定语言、场景及样例内容；与本机路径和应用进程无关。 */
import { folderPath, iconId, subvaultId } from '../../src/Subvaults/Subvault';
import type { PluginDocument } from '../../src/Persistence/PluginDocument';

export const languages = [
  { id: 'en', obsidian: 'en', newNote: 'New note', readme: 'README.md' },
  { id: 'zh-Hans', obsidian: 'zh', newNote: '新建笔记', readme: 'README.zh-Hans.md' },
] as const;
export type Language = typeof languages[number];
export const scenes = ['all', 'subvault', 'create'] as const;
export type Scene = typeof scenes[number];
export const viewport = { width: 1120, height: 520, scale: 2 } as const;
export interface CaptureArea { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export const newSubvault = { folder: 'Leisure', icon: 'gamepad-2', color: 'Orange' } as const;
export const researchId = subvaultId('22222222-2222-4222-8222-222222222222');
export const activeNote = 'Research/Attention & memory.md';
export const externalNote = 'Learning/Reading plan.md';
export const expandedFolders = ['Learning', 'Leisure', 'Research', 'Research/Papers'] as const;
export const vaultMarker = 'Subvaults screenshot fixtures\n';

export const pluginData: PluginDocument = {
  version: 1,
  subvaults: [
    { id: subvaultId('11111111-1111-4111-8111-111111111111'), root: folderPath('Learning'), icon: iconId('graduation-cap'), color: 'blue' },
    { id: researchId, root: folderPath('Research'), icon: iconId('flask-conical'), color: 'purple' },
  ],
  navigation: { selection: { kind: 'all' }, positions: [] },
};

export const notes: readonly { readonly path: string; readonly content: string }[] = [
  { path: externalNote, content: 'A small reading list for the week.\n\n## This week\n\n- [ ] Read one chapter on memory\n- [ ] Review [[Statistics]]\n- [ ] Add observations to [[Research/Experiment log|Experiment log]]\n\n## Reading habit\n\nTwenty focused minutes each morning, followed by a short note in my own words.\n' },
  { path: 'Learning/Statistics.md', content: '## Questions to revisit\n\n- How large is the effect?\n- What does the confidence interval tell us?\n- Can the result be reproduced?\n' },
  { path: activeNote, content: 'How does a short break affect recall after a focused reading session?\n\n> [!note] Working question\n> Compare uninterrupted reading with two shorter sessions separated by a walk.\n\n## Study plan\n\n- [x] Collect background papers\n- [ ] Run three short reading sessions\n- [ ] Compare next-day recall\n\n## Materials\n\n| Resource | Purpose |\n| --- | --- |\n| [Reading notes](Papers/Reading%20notes.md) | Background and open questions |\n| [[Experiment log]] | Session observations |\n| [Reading plan](../Learning/Reading%20plan.md) | This week’s reading schedule |\n' },
  { path: 'Research/Experiment log.md', content: '## Pilot session\n\nA 20-minute reading session followed by a short recall exercise.\n\n- Record duration and interruptions.\n- Repeat the recall exercise the next morning.\n' },
  { path: 'Research/Papers/Reading notes.md', content: '## Literature notes\n\nCapture the question, method, and one useful result from each paper.\n\n## To explore\n\n- Spaced practice\n- Attention and breaks\n- Next-day recall\n' },
  { path: 'Leisure/Books.md', content: '## On the shelf\n\n- A short story collection\n- A book about the natural world\n\n## Reading for pleasure\n\nLeave room for an unexpected recommendation.\n' },
  { path: 'Leisure/Films.md', content: '## Weekend watchlist\n\n- A documentary\n- A favorite film to revisit\n\nKeep a few thoughts after watching.\n' },
];

export function imageName(scene: Scene, version: string, language: Language['id']): string {
  return `${scene}-v${version}-${language}.png`;
}
