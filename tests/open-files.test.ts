/** 用宿主边界替身执行实际适配代码，回归辅助面板和延迟文件标签的分类。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import type { App } from 'obsidian';
import type { openFilePaths } from '../src/FileNavigation/OpenFiles';

class FileView {
  constructor(readonly file: { readonly path: string } | null, readonly navigation = true) {}
}
interface Leaf { readonly view: object; readonly isDeferred: boolean; getViewState(): { type: string; state: { file: string } } }
const leaf = (type: string, file: string, view: object = {}, isDeferred = true): Leaf => ({ view, isDeferred, getViewState: () => ({ type, state: { file } }) });
const compiled = buildSync({ entryPoints: [fileURLToPath(new URL('../src/FileNavigation/OpenFiles.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', external: ['obsidian'], write: false });
const module = { exports: {} as { openFilePaths: typeof openFilePaths } };
runInNewContext(compiled.outputFiles[0]!.text, { module, exports: module.exports, require: (id: string) => { assert.equal(id, 'obsidian'); return { FileView }; } });
const read = (leaves: readonly Leaf[], registered: Readonly<Record<string, string>>, files: ReadonlySet<string>): readonly string[] => {
  const app = {
    workspace: { iterateAllLeaves: (visit: (leaf: Leaf) => void) => { for (const leaf of leaves) visit(leaf); } },
    vault: { getFileByPath: (path: string) => files.has(path) ? { path, extension: path.split('.').at(-1)! } : null },
    viewRegistry: { getTypeByExtension: (extension: string) => registered[extension] },
  } as unknown as App;
  return [...module.exports.openFilePaths(app)];
};

test('closed files referenced by deferred or loaded auxiliary FileViews are not open tabs', () => {
  const file = 'Closed.md', files = new Set([file]);
  const panels = ['backlink', 'outgoing-link', 'outline'].flatMap(type => [
    leaf(type, file), leaf(type, file, new FileView({ path: file }, false), false),
  ]);
  assert.deepEqual(read(panels, { md: 'markdown' }, files), []);
});

test('real file tabs include loaded files and registered deferred Markdown, Canvas and plugin formats', () => {
  const files = new Set(['Live.md', 'Background.md', 'Board.canvas', 'Custom.diagram']);
  const leaves = [
    leaf('markdown', 'Live.md', new FileView({ path: 'Live.md' }), false),
    leaf('markdown', 'Background.md'), leaf('canvas', 'Board.canvas'), leaf('diagram-view', 'Custom.diagram'),
    leaf('outline', 'Background.md'), leaf('markdown', 'Deleted.md'),
    leaf('unrelated-panel', 'Live.md', {}, false),
  ];
  assert.deepEqual(read(leaves, { md: 'markdown', canvas: 'canvas', diagram: 'diagram-view' }, files), [...files]);
});

test('each read follows current workspace tabs and the current host registration without retaining closed files', () => {
  const file = 'Outside.md', files = new Set([file]), registered = { md: 'markdown' };
  const tab = leaf('markdown', file), panel = leaf('outline', file);
  assert.deepEqual(read([tab, panel], registered, files), [file]);
  assert.deepEqual(read([panel], registered, files), []);
  registered.md = 'alternate-editor';
  assert.deepEqual(read([tab, panel], registered, files), []);
  assert.deepEqual(read([leaf('alternate-editor', file), panel], registered, files), [file]);
});
