/** 在 Debug-Vault 验证浏览状态的独立存储、重载恢复及配置提交，结束后恢复原状态。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const fs = require('node:fs');
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('navigation-storage-verification', ['tests']);
  const report = join(directories.tests, 'results.json'), results = [];
  const key = 'subvaults:navigation';
  const dataPath = join(app.vault.adapter.getBasePath(), app.vault.configDir, 'plugins/subvaults/data.json');
  const session = () => app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const run = async (name, body) => {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error), stack: error.stack }); throw error; }
  };
  const workspace = app.workspace, active = workspace.activeLeaf, collapsed = workspace.leftSplit.collapsed;
  const leaf = workspace.getLeavesOfType('file-explorer')[0];
  const side = leaf.parent.children.find(child => child.containerEl.isShown());
  await session().navigation.flush();
  const originalData = fs.readFileSync(dataPath), originalLocal = app.loadLocalStorage(key);
  const originalCatalog = [...session().catalog.items];
  let writes = 0;
  const undo = [];
  const spy = () => {
    const plugin = app.plugins.plugins.subvaults, save = plugin.saveData;
    plugin.saveData = function (data) { writes++; return save.call(this, data); };
    undo.push(() => { plugin.saveData = save; });
  };
  try {
    await workspace.revealLeaf(leaf);
    spy();
    await run('configuration and local navigation load independently', async () => {
      const data = JSON.parse(originalData);
      check(equal(Object.keys(data), ['subvaults']), 'Unexpected configuration format');
      check(equal(data.subvaults, originalCatalog), 'Configuration differs from the active catalog');
      check(equal(Object.keys(originalLocal).sort(), ['positions', 'selection']) && equal(originalLocal.selection, session().navigation.selection), 'Local selection was not restored');
      check(originalCatalog.length > 1, 'Prepare at least two Debug-Vault subvaults first');
    });
    const long = originalCatalog.find(item => item.root === 'Testing/Long list');
    check(long, 'Prepare the long-list Debug-Vault fixture first');
    const selection = { kind: 'subvault', id: long.id };
    const scroll = leaf.view.navFileContainerEl;
    let wanted;
    await run('switching and native scrolling do not write data.json', async () => {
      const header = leaf.view.containerEl.querySelector('.sv-header');
      session().navigation.switchTo(selection); await delay(180);
      scroll.scrollTop = 720; await delay(300); wanted = scroll.scrollTop;
      check(wanted > 500, 'Long list did not scroll');
      const local = app.loadLocalStorage(key);
      check(equal(local.selection, selection), 'Selection was not saved locally');
      check(local.positions.some(p => equal(p.selection, selection) && Math.abs(p.top - wanted) < 1), 'Scroll event did not save locally');
      session().navigation.switchTo({ kind: 'all' }); await delay(100);
      session().navigation.switchTo(selection); await delay(250);
      check(Math.abs(scroll.scrollTop - wanted) < 2, 'Switching did not restore scroll');
      check(leaf.view.containerEl.querySelector('.sv-header') === header, 'Switching replaced the header');
      check(writes === 0 && fs.readFileSync(dataPath).equals(originalData), 'Browsing wrote configuration');
    });
    await run('plugin reload retains local selection and scroll without changing configuration', async () => {
      await session().navigation.flush();
      await app.plugins.disablePlugin('subvaults');
      await app.plugins.enablePlugin('subvaults'); await delay(300);
      spy();
      check(equal(session().navigation.selection, selection), 'Reload lost the selection');
      check(Math.abs(scroll.scrollTop - wanted) < 2, 'Reload lost the scroll position');
      check(leaf.view.containerEl.querySelectorAll('.sv-switcher').length === 1, 'Reload duplicated the switcher');
      check(writes === 0 && fs.readFileSync(dataPath).equals(originalData), 'Reload wrote configuration');
    });
    await run('reordering saves only configuration and preserves the selected view', async () => {
      const last = originalCatalog.at(-1), first = originalCatalog[0];
      const result = await session().catalog.move(last.id, { anchor: first.id, side: 'before' });
      check(result.ok, 'Could not save the new order');
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      check(writes === 1 && equal(data.subvaults, session().catalog.items), 'Reordering did not save the catalog');
      check(equal(Object.keys(data), ['subvaults']), 'Configuration contains unexpected state');
      check(equal(session().navigation.selection, selection) && equal(app.loadLocalStorage(key).selection, selection), 'Reordering changed the selected view');
    });
  } catch (error) {
    if (results.at(-1)?.passed !== false) results.push({ name: 'verification setup', passed: false, error: String(error), stack: error.stack });
  }
  finally {
    try {
      for (const restore of undo) restore();
      await app.plugins.disablePlugin('subvaults');
      fs.writeFileSync(dataPath, originalData);
      app.saveLocalStorage(key, originalLocal);
      await app.plugins.enablePlugin('subvaults'); await delay(250);
      if (side) await workspace.revealLeaf(side);
      if (collapsed) workspace.leftSplit.collapse();
      if (active) workspace.setActiveLeaf(active, { focus: false });
      check(fs.readFileSync(dataPath).equals(originalData) && equal(session().catalog.items, originalCatalog), 'Original configuration was not restored');
    } catch (error) { results.push({ name: 'restore original state', passed: false, error: String(error), stack: error.stack }); }
    fs.writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), results }, null, 2));
  }
  const passed = results.length === 4 && results.every(result => result.passed);
  console.log('Navigation storage verification:', passed, report);
  return { passed, report, results };
};
