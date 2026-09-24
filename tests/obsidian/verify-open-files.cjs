/** 在 Debug-Vault 验证文件标签、延迟标签与辅助面板文件引用的边界。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const { writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { name, directories } = require('../../scripts/artifact-run.cjs')('open-files-verification', ['tests']);
  const report = join(directories.tests, 'results.json'), results = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => {
    for (let i = 0; i < 80; i++) { if (predicate()) return; await delay(25); }
    throw new Error(message);
  };
  const run = async (name, body) => {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error), stack: error.stack }); }
    writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), results }, null, 2));
  };
  const workspace = app.workspace;
  const session = () => app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const selected = session().navigation.selection, active = workspace.activeLeaf;
  const rightCollapsed = workspace.rightSplit.collapsed;
  let rightActive;
  workspace.iterateAllLeaves(leaf => {
    if (leaf.getRoot() === workspace.rightSplit && leaf.containerEl.isShown()) rightActive = leaf;
  });
  const anchor = workspace.getMostRecentLeaf();
  const view = workspace.getLeavesOfType('file-explorer')[0].view;
  const projects = session().catalog.items.find(item => item.root === 'Projects');
  check(projects, 'Prepare the Projects subvault');
  const scope = { kind: 'subvault', id: projects.id };
  const created = new Set();
  const close = leaf => { leaf.detach(); created.delete(leaf); };
  const folder = `Testing/${name}`;
  await app.vault.createFolder(folder);
  const first = await app.vault.create(`${folder}/First.md`, '# First\n');
  const second = await app.vault.create(`${folder}/Second.md`, '# Second\n');
  const canvas = await app.vault.create(`${folder}/Board.canvas`, '{"nodes":[],"edges":[]}');
  const count = file => view.getSortedFolderItems(app.vault.getRoot()).filter(item => item.file === file).length;
  const background = async (type, file, side = false) => {
    const leaf = side ? workspace.getRightLeaf(false) : workspace.getLeaf('tab');
    created.add(leaf);
    if (!side) workspace.setActiveLeaf(anchor, { focus: false });
    await leaf.setViewState({ type, state: { file: file.path }, icon: 'file', title: file.basename, active: false });
    check(leaf.isDeferred, `${type} fixture must use a native DeferredView`);
    return leaf;
  };
  try {
    session().navigation.switchTo(scope);
    workspace.rightSplit.collapse();
    const panels = [];
    for (const [type, file] of [['backlink', first], ['outgoing-link', first], ['outline', second]]) {
      const panel = await background(type, file, true);
      panel.setPinned(true);
      panels.push(panel);
    }
    await run('deferred auxiliary panels do not open their referenced files', async () => {
      await delay(250);
      check(count(first) === 0 && count(second) === 0, 'Auxiliary file references leaked into external items');
      check(panels.every(leaf => leaf.isDeferred), 'Reading open files forced auxiliary views to load');
    });
    await run('deferred file tabs survive reload, deduplicate with loaded tabs and disappear on final close', async () => {
      const deferred = await background('markdown', first);
      await waitFor(() => count(first) === 1, 'Deferred file tab was omitted');
      await session().navigation.flush();
      await app.plugins.disablePlugin('subvaults');
      await app.plugins.enablePlugin('subvaults');
      check(deferred.isDeferred && count(first) === 1, 'Reload lost or forced the deferred file tab');
      const duplicate = workspace.getLeaf('tab'); created.add(duplicate);
      await duplicate.openFile(first);
      await delay(150);
      check(count(first) === 1, 'Same file appeared more than once');
      close(duplicate);
      await delay(150);
      check(count(first) === 1, 'Closing a loaded duplicate removed the deferred file');
      close(deferred);
      await waitFor(() => count(first) === 0, 'Final file close left an auxiliary reference visible');
      check(!view.fileItems[first.path].el.classList.contains('sv-external'), 'Closed file retained italic styling');
    });
    await run('loaded auxiliary panels and All round trips cannot restore closed files', async () => {
      for (const leaf of panels) {
        const file = leaf.getViewState().state.file;
        await workspace.revealLeaf(leaf);
        check(!leaf.isDeferred, 'Auxiliary view did not load');
        check(leaf.getViewState().state.file === file, 'Pinned auxiliary view lost its file reference');
      }
      session().navigation.switchTo({ kind: 'all' });
      session().navigation.switchTo(scope);
      await delay(250);
      check(count(first) === 0 && count(second) === 0, 'Loaded auxiliary views or switching restored a closed file');
      check([first, second].every(file => !view.fileItems[file.path].el.classList.contains('sv-external')), 'Closed files retained external styling');
    });
    await run('registered non-Markdown tabs and real sidebar file tabs remain external', async () => {
      const deferred = await background('canvas', canvas);
      await waitFor(() => count(canvas) === 1, 'Deferred canvas file was omitted');
      check(deferred.isDeferred, 'Reading open files forced the canvas to load');
      await workspace.revealLeaf(deferred);
      await delay(150);
      check(count(canvas) === 1, 'Loaded canvas file was omitted');
      workspace.rightSplit.collapse();
      const side = await background('markdown', second, true);
      await waitFor(() => count(second) === 1, 'Deferred sidebar file tab was omitted');
      await workspace.revealLeaf(side);
      await delay(150);
      check(count(second) === 1, 'Loaded sidebar file tab was omitted');
      close(side); close(deferred);
      await waitFor(() => count(second) === 0 && count(canvas) === 0, 'Closed file tabs remained external');
    });
  } finally {
    for (const leaf of created) close(leaf);
    session().navigation.switchTo(selected);
    if (rightActive) await workspace.revealLeaf(rightActive);
    if (rightCollapsed) workspace.rightSplit.collapse();
    if (active) workspace.setActiveLeaf(active, { focus: false });
    await app.vault.trash(app.vault.getFolderByPath(folder), false);
  }
  console.log('Open files verification:', JSON.stringify({ report, passed: results.every(result => result.passed), results }));
  return { report, passed: results.every(result => result.passed), results };
};
