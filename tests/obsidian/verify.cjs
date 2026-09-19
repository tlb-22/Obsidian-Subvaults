/** 在指定 Debug-Vault 的开发控制台执行真实宿主验收，保存独立可审阅的证据。 */
module.exports = async app => {
  const fs = require('fs');
  require('./debug-vault.cjs')(app);
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('host-verification', ['tests']);
  const report = join(directories.tests, 'results.json');
  console.info('Host verification report:', report);
  const results = [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => {
    for (let i = 0; i < 80; i++) { if (predicate()) return; await delay(25); }
    throw new Error(message);
  };
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const run = async (name, body) => {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error), stack: error.stack }); }
    fs.writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), obsidian: '1.13.7', results }, null, 2));
  };
  const session = () => app.plugins.plugins['subvaults']._children.find(child => child.catalog && child.navigation);
  const v = app.workspace.getLeavesOfType('file-explorer')[0].view;
  const all = { kind: 'all' };
  const appearance = { icon: 'folder', color: 'blue' };
  const ensure = async root => {
    const s = session().catalog.items.find(s => s.root === root);
    if (s) return s.id;
    const result = await session().catalog.create(root, appearance);
    check(result.ok, `Could not create ${root}`); return result.value;
  };
  const projectId = await ensure('Projects');
  const alphaId = await ensure('Projects/Alpha');
  const longId = await ensure('Testing/Long list');
  const top = () => v.getSortedFolderItems(app.vault.getRoot()).map(item => item.file.path);
  const select = async id => { session().navigation.switchTo(id ? { kind: 'subvault', id } : all); await delay(80); };
  await run('native folder root and overlapping selection', async () => {
    await select(projectId);
    check(JSON.stringify(top().filter(p => p.startsWith('Projects/'))) === JSON.stringify(v.getSortedFolderItems(app.vault.getFolderByPath('Projects')).map(i => i.file.path)), 'Internal order differs from native');
    const header = v.containerEl.querySelector('.sv-header');
    await select(alphaId);
    check(top().includes('Projects/Alpha/Plan.md'), 'Nested root did not render');
    check(!top().includes('Projects/Overview.md'), 'Unopened outside file leaked');
    check(header === v.containerEl.querySelector('.sv-header'), 'Header was replaced');
    await select(projectId);
    check(header === v.containerEl.querySelector('.sv-header'), 'Header identity was lost');
  });
  await run('native sorting follows all supported native modes', async () => {
    const initial = v.sortOrder;
    for (const mode of ['alphabetical', 'alphabeticalReverse', 'byModifiedTime', 'byModifiedTimeReverse', 'byCreatedTime', 'byCreatedTimeReverse']) {
      v.setSortOrder(mode); await delay(40);
      const expected = v.getSortedFolderItems(app.vault.getFolderByPath('Projects')).map(i => i.file.path);
      check(JSON.stringify(top().filter(p => p.startsWith('Projects/'))) === JSON.stringify(expected), `Native ordering differs for ${mode}`);
    }
    v.setSortOrder(initial);
  });
  await run('external files are native items, deduplicated and removed on final close', async () => {
    await select(projectId);
    const file = app.vault.getFileByPath('Outside.md');
    const prior = []; app.workspace.iterateAllLeaves(leaf => { if (leaf.getViewState().state?.file === file.path) prior.push(leaf); });
    for (const leaf of prior) leaf.detach();
    const a = app.workspace.getLeaf('tab'); await a.openFile(file);
    const b = app.workspace.getLeaf('tab'); await b.openFile(file); await delay(100);
    check(a !== b, 'Test requires two distinct file leaves');
    check(top().filter(p => p === file.path).length === 1, 'External duplicate or missing item');
    check(v.getSortedFolderItems(app.vault.getRoot()).find(i => i.file === file) === v.fileItems[file.path], 'External item is not native');
    check(v.fileItems[file.path].el.classList.contains('sv-external'), 'External styling missing');
    check(v.fileItems[file.path].el.classList.contains('sv-external-first'), 'Divider missing');
    v.revealInFolder(file); await delay(60);
    check(session().navigation.selection.id === projectId, 'Reveal changed subvault');
    a.detach(); await delay(60); check(top().includes(file.path), 'Closing one tab removed live external file');
    b.detach(); await delay(100); check(!top().includes(file.path), 'Closed external file remained');
  });
  await run('switching preserves native folds and workspace tabs', async () => {
    await select(projectId);
    const folder = v.fileItems['Projects/Alpha']; folder.setCollapsed(false, false);
    const leaves = () => { const out = []; app.workspace.iterateAllLeaves(l => out.push([l.id, l.getViewState().type, l.getViewState().state?.file])); return JSON.stringify(out); };
    const before = leaves(); await select(alphaId); await select(); await select(projectId);
    check(!folder.collapsed, 'Native expansion changed during switch'); check(before === leaves(), 'Workspace leaves changed');
  });
  await run('long native tree renders and restores per-view scroll', async () => {
    await select(longId); await delay(100);
    const scroll = v.navFileContainerEl;
    check(scroll.scrollHeight > scroll.clientHeight * 2, 'Virtual tree has no scrollable contents');
    scroll.scrollTop = 1200; await delay(240); const wanted = scroll.scrollTop;
    check(wanted > 500, 'Could not scroll long tree');
    await select(projectId); await select(longId); await delay(240);
    check(Math.abs(scroll.scrollTop - wanted) < 5, `Scroll was not restored: ${scroll.scrollTop} vs ${wanted}`);
  });
  await run('duplicate creation is rejected', async () => {
    const before = session().catalog.items.length;
    const result = await session().catalog.create('Projects', appearance);
    check(!result.ok && result.error.kind === 'duplicate-folder', 'Duplicate was accepted');
    check(session().catalog.items.length === before, 'Duplicate changed configuration');
  });
  await run('folder rename and deletion preserve identity then select All', async () => {
    const path = 'Testing/Lifecycle-' + Date.now();
    await app.vault.createFolder(path); await app.vault.createFolder(path + '/Child');
    const parent = await ensure(path), child = await ensure(path + '/Child');
    await select(child);
    const renamed = path + '-renamed'; await app.fileManager.renameFile(app.vault.getFolderByPath(path), renamed);
    await waitFor(() => session().catalog.items.find(s => s.id === child)?.root === renamed + '/Child', 'Child binding did not follow rename');
    check(session().catalog.items.find(s => s.id === parent)?.root === renamed, 'Parent binding did not follow rename');
    await app.vault.trash(app.vault.getFolderByPath(renamed), false);
    await waitFor(() => !session().catalog.items.some(s => s.id === parent || s.id === child), 'Deleted folder bindings remained');
    check(session().navigation.selection.kind === 'all', 'Deleting active folder did not select All');
  });
  await run('creation UI has a persistent single-select folder tree and cancel restores view', async () => {
    await select(projectId);
    v.containerEl.querySelector('[aria-label="Create subvault"]').click(); await delay(40);
    const panel = v.containerEl.querySelector('.sv-create-panel'); check(panel, 'Create panel missing');
    check(panel.querySelector('[role="tree"]'), 'Folder tree missing');
    check(panel.querySelector('[data-sv-folder="Projects"]').getAttribute('aria-disabled') === 'true', 'Bound folder is selectable');
    check(panel.querySelectorAll('input').length === 1, 'Unexpected name input');
    const cancel = [...panel.querySelectorAll('button')].find(b => b.textContent === 'Cancel'); cancel.click();
    check(!v.containerEl.querySelector('.sv-create-panel'), 'Cancel did not close');
    check(session().navigation.selection.id === projectId, 'Cancel changed current view');
  });
  await run('native toolbar creates inside the subvault while global creation stays native', async () => {
    await select(projectId);
    await app.workspace.getLeaf('tab').openFile(app.vault.getFileByPath('Outside.md'));
    const existing = new Set(app.vault.getFiles().map(f => f.path));
    v.containerEl.querySelectorAll('.nav-header .nav-action-button')[0].click();
    await waitFor(() => app.vault.getFiles().some(f => !existing.has(f.path)), 'Toolbar did not create a note');
    const file = app.vault.getFiles().find(f => !existing.has(f.path));
    check(file.parent.path === 'Projects', 'Toolbar created outside the subvault');
    const before = new Set(app.vault.getFiles().map(f => f.path));
    app.commands.executeCommandById('file-explorer:new-file');
    await waitFor(() => app.vault.getFiles().some(f => !before.has(f.path)), 'Global new note did not run');
    const globalFile = app.vault.getFiles().find(f => !before.has(f.path));
    check(globalFile.parent.isRoot(), 'Global new note was redirected');
  });
  await run('plugin reload restores configuration and native unload restores the full tree', async () => {
    await select(projectId); await session().navigation.flush(); await delay(100);
    await app.plugins.disablePlugin('subvaults');
    check(!v.containerEl.querySelector('.sv-header'), 'Header survived unload');
    check(top().includes('Reading') && top().includes('Projects'), 'Full native tree was not restored');
    check(!v.containerEl.querySelector('.sv-external'), 'External styling survived unload');
    await app.plugins.enablePlugin('subvaults'); await delay(180);
    check(session().navigation.selection.id === projectId, 'Last selection was not restored');
    check(v.containerEl.querySelectorAll('.sv-header').length === 1, 'Reload duplicated header');
  });
  console.log('Subvaults host verification', results);
  return results;
};
