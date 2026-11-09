/** 在 Debug-Vault 中向已挂载的文件树派发拖放事件，核对宿主提示和真实文件路径。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const session = app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const project = session.catalog.items.find(item => item.root === 'Projects');
  const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
  const view = leaf.view, tree = view.navFileContainerEl;
  const win = tree.ownerDocument.defaultView;
  const manager = app.dragManager;
  const originalSelection = session.navigation.selection, originalDrag = manager.draggable;
  const originalAction = manager.setAction;
  const originalCollapsed = view.fileItems['Projects/Alpha'].collapsed;
  const results = [];
  const delay = ms => new Promise(resolve => win.setTimeout(resolve, ms));
  let action;
  const file = await app.vault.create('Projects/Drop-target-' + Date.now() + '.md', 'Drag test');
  async function drop(label, target, folder) {
    if (!tree.contains(target)) throw new Error(label + ': target is not in the displayed tree');
    manager.draggable = { type: 'file', file };
    const transfer = new win.DataTransfer();
    const hints = [];
    for (const type of ['dragenter', 'dragover', 'drop']) {
      action = null;
      target.dispatchEvent(new win.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
      if (type !== 'drop') hints.push(action);
    }
    await delay(200);
    if (file.parent !== folder || hints.some(hint => !hint?.includes(folder.name || app.vault.getName()))) {
      throw new Error(label + ': ' + JSON.stringify({ hints, path: file.path }));
    }
    results.push(label);
  }
  try {
    manager.setAction = function (text) { action = text; return originalAction.call(this, text); };
    session.navigation.switchTo({ kind: 'subvault', id: project.id });
    await delay(200);
    const root = app.vault.getFolderByPath('Projects');
    const sub = app.vault.getFolderByPath('Projects/Alpha');
    const sibling = view.fileItems['Projects/Overview.md'].selfEl;
    await drop('own top-level row', view.fileItems[file.path].selfEl, root);
    await drop('sibling top-level row', sibling, root);
    await drop('top-level whitespace', tree, root);
    await drop('subfolder title', view.fileItems[sub.path].selfEl, sub);
    await view.fileItems[sub.path].setCollapsed(false, false);
    await delay(100);
    await drop('nested file row', view.fileItems['Projects/Alpha/Plan.md'].selfEl, sub);
    await drop('return to displayed root via sibling', sibling, root);
    await drop('subfolder before whitespace', view.fileItems[sub.path].selfEl, sub);
    await drop('return to displayed root via whitespace', tree, root);
    session.navigation.switchTo({ kind: 'all' });
    await drop('All vault root', tree, app.vault.getRoot());
    return results;
  } finally {
    manager.setAction = originalAction;
    manager.draggable = originalDrag;
    await view.fileItems['Projects/Alpha'].setCollapsed(originalCollapsed, false);
    session.navigation.switchTo(originalSelection);
    await app.vault.trash(file, false);
  }
};
