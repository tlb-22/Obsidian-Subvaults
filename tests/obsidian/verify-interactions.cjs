/** 在 Debug-Vault 的开发控制台执行：验证真实拖放、提示及逐帧切换稳定性。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('interaction-verification', ['tests']);
  const report = join(directories.tests, 'results.json');
  console.info('Interaction verification report:', report);
  const fs = require('fs'), results = [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const run = async (name, body) => {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error), stack: error.stack }); }
    fs.writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), obsidian: '1.13.7', results }, null, 2));
  };
  const session = () => app.plugins.plugins['subvaults']._children.find(child => child.catalog && child.navigation);
  const v = app.workspace.getLeavesOfType('file-explorer')[0].view;
  const panel = v.containerEl.querySelector('.sv-create-panel');
  if (panel) [...panel.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click();
  const projectId = session().catalog.items.find(s => s.root === 'Projects').id;
  const alphaId = session().catalog.items.find(s => s.root === 'Projects/Alpha').id;
  const select = id => session().navigation.switchTo(id ? { kind: 'subvault', id } : { kind: 'all' });
  select(projectId);
  await run('native tooltip shows complete external path and hover preview event survives', async () => {
    const file = app.vault.getFileByPath('Reading/Books/Notes.md');
    await app.workspace.getLeaf('tab').openFile(file); await delay(150);
    const title = v.fileItems[file.path].selfEl;
    check(title.getAttribute('aria-label') === file.path, 'Full path tooltip is absent');
    let previews = 0;
    const ref = app.workspace.on('hover-link', args => { if (args.linktext === file.path) previews++; });
    try {
      title.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', clientX: 140, clientY: 280 }));
      await delay(1200);
      check([...document.querySelectorAll('.tooltip')].some(el => el.textContent === file.path), 'Native delayed tooltip did not render');
      check(previews > 0, 'Hover preview event was lost');
      title.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body }));
      select(); await delay(60);
      check(!title.hasAttribute('aria-label'), 'External tooltip survived All');
      select(projectId);
    } finally { app.workspace.offref(ref); }
  });
  await run('native blank-root and nested-folder drop targets move actual files', async () => {
    select(projectId);
    const original = app.dragManager.draggable;
    const file = await app.vault.create('Testing/Drop-' + Date.now() + '.md', 'Disposable drag test');
    try {
      app.dragManager.draggable = { type: 'file', file };
      v.navFileContainerEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      await delay(200);
      check(file.parent.path === 'Projects', 'Blank-area drop did not target subvault root');
      v.fileItems['Projects/Alpha'].el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      await delay(200);
      check(file.parent.path === 'Projects/Alpha', 'Nested drop lost its native target');
    } finally { app.dragManager.draggable = original; await app.vault.trash(file, false); }
  });
  await run('native new-folder toolbar targets subvault root', async () => {
    select(projectId);
    const before = new Set(app.vault.getAllLoadedFiles().map(f => f.path));
    v.containerEl.querySelectorAll('.nav-header .nav-action-button')[1].click(); await delay(200);
    const folder = app.vault.getAllLoadedFiles().find(f => !before.has(f.path));
    check(folder && folder.parent.path === 'Projects' && folder.children, 'New folder was created outside subvault');
    v.exitRename(); await app.vault.trash(folder, false);
  });
  await run('frame samples preserve header identity and never expose unrelated roots', async () => {
    select(projectId);
    const header = v.containerEl.querySelector('.sv-header');
    const initial = header.getBoundingClientRect();
    for (let i = 0; i < 24; i++) {
      const id = i % 2 ? projectId : alphaId, name = i % 2 ? 'Projects' : 'Alpha';
      select(id);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Host window must remain visible for frame sampling')), 2000);
        requestAnimationFrame(() => { clearTimeout(timeout); resolve(); });
      });
      const current = v.containerEl.querySelector('.sv-header'), rect = current.getBoundingClientRect();
      check(current === header && rect.y === initial.y && rect.height === initial.height && rect.height > 0, 'Header shifted or was replaced');
      check(current.textContent === name, 'Title did not update synchronously');
      check(!v.navFileContainerEl.querySelector('[data-path="Reading"], [data-path="Testing"]'), 'Unrelated vault root flashed');
    }
  });
  await run('unload releases external tooltip attributes and reload restores them', async () => {
    select(projectId); await session().navigation.flush();
    const title = v.fileItems['Reading/Books/Notes.md'].selfEl;
    await app.plugins.disablePlugin('subvaults');
    check(!title.hasAttribute('aria-label'), 'Tooltip attribute survived unload');
    await app.plugins.enablePlugin('subvaults'); await delay(150);
    check(title.getAttribute('aria-label') === 'Reading/Books/Notes.md', 'Tooltip missing after reload');
  });
  console.log('Subvaults interaction verification', results);
  return results;
};
