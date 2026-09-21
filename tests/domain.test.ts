/** 验证路径身份、重叠文件夹、生命周期和外部文件归属的纯业务边界。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubvault, followFolderChange, folderPath, iconId, subvaultId, type Subvault } from '../src/Subvaults/Subvault';
import { outsideFiles } from '../src/FileNavigation/NavigationState';
import { visibleFolders } from '../src/Subvaults/FolderChoices';
import { decodeDocument, emptyDocument } from '../src/Persistence/PluginDocument';
import { moveSubvault } from '../src/Subvaults/SubvaultOrder';
const space = (root: string, id = root): Subvault => ({ id: subvaultId(id), root: folderPath(root), icon: iconId('folder'), color: 'default' });

test('a folder is unique, while nested and same-name folders have independent identities', () => {
  const current = [space('Projects')];
  assert.equal(createSubvault(current, space('Projects', 'other'), true).ok, false);
  assert.equal(createSubvault(current, space('Projects/Alpha'), true).ok, true);
  assert.equal(createSubvault(current, space('Archive/Projects'), true).ok, true);
  assert.equal(createSubvault(current, space('Missing'), false).ok, false);
});
test('ancestor rename follows segment boundaries and preserves identities and appearance', () => {
  const current = [space('Projects'), space('Projects/Alpha'), space('Projects-old')];
  const next = followFolderChange(current, { kind: 'rename', oldPath: 'Projects', path: 'Archive/Work' });
  assert.deepEqual(next.map(s => s.root), ['Archive/Work', 'Archive/Work/Alpha', 'Projects-old']);
  assert.deepEqual(next.map(s => s.id), current.map(s => s.id));
  assert.strictEqual(next[2], current[2]);
  assert.deepEqual(followFolderChange(next, { kind: 'delete', path: 'Archive' }), [current[2]]);
});
test('reordering places a subvault on either side of an anchor without changing identities or bindings', () => {
  const a = space('A'), b = space('B'), c = space('C'), d = space('D');
  const current = [a, b, c, d];
  for (const [source, anchor, side, expected] of [
    [a, d, 'after', [b, c, d, a]], [d, a, 'before', [d, a, b, c]],
    [a, c, 'before', [b, a, c, d]], [d, b, 'after', [a, b, d, c]],
  ] as const) {
    const result = moveSubvault(current, source.id, { anchor: anchor.id, side });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('Expected a valid move');
    assert.deepEqual(result.value, expected);
    result.value.forEach((item, i) => assert.strictEqual(item, expected[i]));
  }
  assert.deepEqual(current, [a, b, c, d]);
});
test('unchanged positions keep the same list and a removed drag source or anchor is reported', () => {
  const a = space('A'), b = space('B'), missing = space('Missing'), current = [a, b];
  for (const [source, anchor, side] of [[a, a, 'after'], [a, b, 'before'], [b, a, 'after']] as const) {
    const result = moveSubvault(current, source.id, { anchor: anchor.id, side });
    assert.ok(result.ok); assert.strictEqual(result.value, current);
  }
  for (const [source, anchor] of [[missing, a], [a, missing]] as const) {
    assert.deepEqual(moveSubvault(current, source.id, { anchor: anchor.id, side: 'before' }), { ok: false, error: { kind: 'subvault-removed' } });
  }
});
test('external files are deduplicated, bounded by path segments and recalculated for overlap', () => {
  const opened = ['Projects/a.md', 'Projects/Alpha/b.md', 'Projects-old/c.md', 'Elsewhere/a.md', 'Elsewhere/a.md'];
  assert.deepEqual(outsideFiles(folderPath('Projects'), opened), ['Elsewhere/a.md', 'Projects-old/c.md']);
  assert.deepEqual(outsideFiles(folderPath('Projects/Alpha'), opened), ['Elsewhere/a.md', 'Projects-old/c.md', 'Projects/a.md']);
});
test('folder tree exposes nested choices under bound folders and preserves search ancestors', () => {
  const paths = ['Projects', 'Projects/Alpha', 'Projects/Alpha/Notes', 'Elsewhere'].map(folderPath);
  assert.deepEqual(visibleFolders(paths, new Set(), '').map(r => r.path), ['Elsewhere', 'Projects']);
  assert.deepEqual(visibleFolders(paths, new Set([folderPath('Projects')]), '').map(r => r.path), ['Elsewhere', 'Projects', 'Projects/Alpha']);
  assert.deepEqual(visibleFolders(paths, new Set(), 'notes').map(r => r.depth), [0, 1, 2]);
});
test('invalid storage is reported instead of being reset to an empty configuration', () => {
  assert.deepEqual(decodeDocument(null), emptyDocument);
  assert.throws(() => decodeDocument({}));
  assert.throws(() => decodeDocument({ ...emptyDocument, subvaults: [space('A'), space('A', 'b')] }));
  assert.throws(() => decodeDocument({ ...emptyDocument, navigation: { selection: { kind: 'all' }, positions: [{ selection: { kind: 'all' }, top: -1 }] } }));
  assert.deepEqual(decodeDocument({ ...emptyDocument, subvaults: [space('A')] }).subvaults, [space('A')]);
  for (const invalid of ['', '/', '../A', 'A/../B', '/A', 'A/', 'A//B']) assert.throws(() => folderPath(invalid));
});
