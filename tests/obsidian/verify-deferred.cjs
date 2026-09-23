/** 在 Debug-Vault 使用真正的 DeferredView 验证后台文件导航的加载与插件生命周期。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const { writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('deferred-verification', ['tests']);
  const report = join(directories.tests, 'results.json'), results = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => {
    for (let i = 0; i < 80; i++) { if (predicate()) return; await delay(25); }
    throw new Error(message);
  };
  const run = async (name, body) => {
    await body();
    results.push({ name, passed: true });
  };
  const workspace = app.workspace;
  const original = workspace.getLeavesOfType('file-explorer')[0];
  const active = workspace.activeLeaf, collapsed = workspace.leftSplit.collapsed;
  const side = original.parent.children.find(leaf => leaf.containerEl.isShown());
  const session = () => app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const selection = JSON.stringify(session().navigation.selection);
  const catalog = JSON.stringify(session().catalog.items);
  const doc = original.view.containerEl.ownerDocument;
  const oldNotices = new Set(doc.querySelectorAll('.notice'));
  const checkNotices = () => check(![...doc.querySelectorAll('.notice')].some(el => !oldNotices.has(el) && el.textContent.includes('Subvaults')), 'Subvaults reported an error during native loading');
  const created = [];
  // Supplying the host's saved icon/title on a hidden leaf uses its normal deferred loading path.
  const createDeferred = async () => {
    const leaf = workspace.getLeftLeaf(false);
    check(leaf, 'Could not create a sidebar leaf');
    created.push(leaf);
    await leaf.setViewState({ ...original.getViewState(), active: false });
    check(leaf.isDeferred, 'Fixture must be a real native DeferredView');
    return leaf;
  };
  try {
    await session().navigation.flush();
    const leaf = await createDeferred(), placeholder = leaf.view;
    await run('background explorer stays deferred without an error or injected controls', async () => {
      await delay(250);
      check(leaf.isDeferred && leaf.view === placeholder, 'Plugin forced a background view to load');
      check(!placeholder.containerEl.querySelector('.sv-switcher'), 'Plugin attached to the placeholder');
      checkNotices();
    });
    await run('plugin reload while deferred preserves the view and saved selection', async () => {
      for (let i = 0; i < 2; i++) {
        await app.plugins.disablePlugin('subvaults');
        await app.plugins.enablePlugin('subvaults');
        check(leaf.isDeferred && leaf.view === placeholder, 'Reload forced native loading');
        check(JSON.stringify(session().navigation.selection) === selection, 'Reload changed selection');
        check(JSON.stringify(session().catalog.items) === catalog, 'Reload changed subvaults');
      }
      checkNotices();
    });
    await run('native reveal attaches once and repeated layout events retain the same controls', async () => {
      await workspace.revealLeaf(leaf);
      await waitFor(() => leaf.view.containerEl.querySelector('.sv-switcher'), 'Loaded explorer did not attach automatically');
      check(!leaf.isDeferred && leaf.view !== placeholder, 'Native view did not load');
      const view = leaf.view, header = view.containerEl.querySelector('.sv-header');
      const switcher = view.containerEl.querySelector('.sv-switcher');
      const selected = session().catalog.items.find(item => item.id === session().navigation.selection.id);
      const root = selected ? app.vault.getFolderByPath(selected.root) : app.vault.getRoot();
      check(root.children.every(file => view.getSortedFolderItems(app.vault.getRoot()).some(item => item.file === file)), 'Restored scope is missing native children');
      for (let i = 0; i < 3; i++) workspace.trigger('layout-change');
      check(view.containerEl.querySelectorAll('.sv-header').length === 1 && view.containerEl.querySelector('.sv-header') === header, 'Layout events duplicated or replaced the header');
      check(view.containerEl.querySelectorAll('.sv-switcher').length === 1 && view.containerEl.querySelector('.sv-switcher') === switcher, 'Layout events duplicated or replaced the switcher');
      checkNotices();
    });
    await run('unloading before native loading leaves no stale attachment and re-enabling works', async () => {
      const pending = await createDeferred();
      await app.plugins.disablePlugin('subvaults');
      check(!leaf.view.containerEl.querySelector('.sv-switcher'), 'Loaded explorer retained plugin controls after unload');
      await workspace.revealLeaf(pending);
      await delay(250);
      check(!pending.isDeferred && !pending.view.containerEl.querySelector('.sv-switcher'), 'Unloaded session attached after native loading');
      await app.plugins.enablePlugin('subvaults');
      check(pending.view.containerEl.querySelectorAll('.sv-switcher').length === 1, 'Ready explorer did not attach on enable');
      check(JSON.stringify(session().navigation.selection) === selection && JSON.stringify(session().catalog.items) === catalog, 'Enable changed saved state');
      checkNotices();
    });
  } catch (error) {
    results.push({ passed: false, error: String(error), stack: error.stack });
  } finally {
    for (const leaf of created) leaf.detach();
    if (!app.plugins.plugins.subvaults) await app.plugins.enablePlugin('subvaults');
    if (side) await workspace.revealLeaf(side);
    if (collapsed) workspace.leftSplit.collapse();
    if (active) workspace.setActiveLeaf(active, { focus: false });
    writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), results }, null, 2));
  }
  console.log('Deferred explorer verification:', results.filter(result => result.passed).length, '/', results.length, report);
  return { report, passed: results.every(result => result.passed), failures: results.filter(result => !result.passed) };
};
