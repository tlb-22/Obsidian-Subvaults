/** 验证异步提交、共享存储和导航恢复的实际协作边界及失败结果。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { folderPath, iconId, subvaultId, type Subvault } from '../src/Subvaults/Subvault';
import { SubvaultCatalog } from '../src/Subvaults/SubvaultCatalog';
import { PluginPersistence } from '../src/Persistence/PluginPersistence';
import { decodeDocument, emptyDocument, type PluginDocument } from '../src/Persistence/PluginDocument';
import { NavigationSession } from '../src/FileNavigation/NavigationSession';
import { all, type Selection } from '../src/FileNavigation/NavigationState';
const appearance = { icon: iconId('folder'), color: 'default' as const };
const existing: Subvault = { ...appearance, id: subvaultId('one'), root: folderPath('Projects') };

test('concurrent creates serialize uniqueness checks and publish only after persistence', async () => {
  let writes = 0, published = 0, ids = 0;
  const catalog = new SubvaultCatalog([], { saveSubvaults: async () => { await Promise.resolve(); writes++; assert.equal(published, 0); } }, () => true, () => subvaultId(`id-${++ids}`));
  catalog.subscribe(() => published++);
  const results = await Promise.all([catalog.create(folderPath('A'), appearance), catalog.create(folderPath('A'), appearance)]);
  assert.deepEqual(results.map(r => r.ok), [true, false]);
  assert.equal(writes, 1); assert.equal(published, 1); assert.equal(catalog.items.length, 1);
});
test('a failed user edit retains the committed state and a later retry succeeds', async () => {
  let fail = true;
  const catalog = new SubvaultCatalog([existing], { saveSubvaults: async () => { if (fail) throw new Error('disk full'); } }, () => true, () => subvaultId('two'));
  assert.equal((await catalog.remove(existing.id)).ok, false); assert.deepEqual(catalog.items, [existing]);
  fail = false; assert.equal((await catalog.remove(existing.id)).ok, true); assert.equal(catalog.items.length, 0);
});
test('reordering commits atomically, preserves navigation, and survives document reload', async () => {
  const second: Subvault = { ...appearance, id: subvaultId('two'), root: folderPath('Research') };
  const initial: PluginDocument = { version: 1, subvaults: [existing, second], navigation: { selection: { kind: 'subvault', id: existing.id }, positions: [{ selection: all, top: 123 }] } };
  let saved = initial, fail = true, published = 0, writes = 0;
  const persistence = new PluginPersistence(initial, async data => { writes++; if (fail) throw new Error('disk full'); saved = data; });
  const catalog = new SubvaultCatalog(initial.subvaults, persistence, () => true, () => subvaultId('new'));
  catalog.subscribe(() => { assert.deepEqual(catalog.items, saved.subvaults); published++; });
  const position = { anchor: existing.id, side: 'before' as const };
  const failure = await catalog.move(second.id, position);
  assert.ok(!failure.ok); assert.equal(failure.error.kind, 'save-failed');
  assert.strictEqual(catalog.items, initial.subvaults); assert.equal(published, 0);
  fail = false;
  assert.ok((await catalog.move(second.id, position)).ok);
  assert.deepEqual(catalog.items, [second, existing]); assert.equal(published, 1);
  const restored = decodeDocument(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.subvaults, [second, existing]); assert.deepEqual(restored.navigation, initial.navigation);
  await catalog.move(second.id, position);
  assert.equal(writes, 2); assert.equal(published, 1);
});
test('queued moves use the latest list and cannot restore a removed subvault', async () => {
  const second: Subvault = { ...appearance, id: subvaultId('two'), root: folderPath('Research') };
  const catalog = new SubvaultCatalog([existing, second], { saveSubvaults: async () => { await Promise.resolve(); } }, () => true, () => subvaultId('three'));
  await Promise.all([catalog.create(folderPath('Learning'), appearance), catalog.move(second.id, { anchor: existing.id, side: 'before' })]);
  assert.deepEqual(catalog.items.map(s => s.id), ['two', 'one', 'three']);
  const results = await Promise.all([catalog.remove(existing.id), catalog.move(second.id, { anchor: existing.id, side: 'after' })]);
  assert.deepEqual(results[1], { ok: false, error: { kind: 'subvault-removed' } });
  assert.deepEqual(catalog.items.map(s => s.id), ['two', 'three']);
});
test('observed deletion removes unavailable folders even if saving fails', async () => {
  const catalog = new SubvaultCatalog([existing], { saveSubvaults: async () => { throw new Error('disk full'); } }, () => false, () => subvaultId('two'));
  const result = await catalog.observe({ kind: 'delete', path: 'Projects' });
  assert.equal(result.ok, false); assert.equal(catalog.items.length, 0);
});
test('concurrent document sections preserve each other and failed writes do not become committed', async () => {
  const writes: PluginDocument[] = []; let reject = false;
  const persistence = new PluginPersistence(emptyDocument, async data => { await Promise.resolve(); if (reject) throw new Error('disk full'); writes.push(data); });
  const navigation = { selection: { kind: 'subvault' as const, id: existing.id }, positions: [] };
  await Promise.all([persistence.saveSubvaults([existing]), persistence.saveNavigation(navigation)]);
  assert.deepEqual(writes.at(-1), { version: 1, subvaults: [existing], navigation });
  reject = true; await assert.rejects(persistence.saveSubvaults([])); reject = false;
  await persistence.saveNavigation(emptyDocument.navigation);
  assert.deepEqual(writes.at(-1)?.subvaults, [existing]);
});
test('views retain independent scroll positions and deleting the active subvault selects All', () => {
  const selection: Selection = { kind: 'subvault', id: existing.id };
  const navigation = new NavigationSession(emptyDocument.navigation, async () => undefined, error => { throw error; });
  navigation.remember(all, 180); navigation.switchTo(selection); navigation.remember(selection, 420);
  navigation.switchTo(all); assert.equal(navigation.position(all), 180);
  navigation.switchTo(selection); assert.equal(navigation.position(selection), 420);
  navigation.reconcile([]); assert.deepEqual(navigation.selection, all); assert.equal(navigation.state.positions.length, 1);
});
