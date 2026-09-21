/** 在 Debug-Vault 派发宿主拖放事件，验证排序、取消、边缘滚动及持久化，最后恢复原顺序。 */
module.exports = async app => {
  require('./debug-vault.cjs')(app);
  const { writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('reorder-verification', ['tests']);
  const report = join(directories.tests, 'results.json'), results = [];
  const view = app.workspace.getLeavesOfType('file-explorer')[0].view;
  const doc = view.containerEl.ownerDocument, win = doc.defaultView;
  const session = () => app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const rail = () => view.containerEl.querySelector('.sv-switcher-rail');
  const buttons = () => [...rail().children];
  const order = () => session().catalog.items.map(s => s.id);
  const original = order(), selection = session().navigation.selection;
  const originalScroll = rail().scrollLeft;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const waitFor = async condition => {
    const start = Date.now();
    while (!condition()) { if (Date.now() - start > 2000) throw new Error('Timed out waiting for host result'); await new Promise(resolve => win.setTimeout(resolve, 20)); }
  };
  const run = async (name, body) => {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error) }); }
    writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), results }, null, 2));
  };
  const event = (target, type, transfer, x) => {
    const rect = rail().getBoundingClientRect();
    const e = new win.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: x, clientY: rect.top + 15 });
    target.dispatchEvent(e); return e;
  };
  const begin = source => { const transfer = new win.DataTransfer(); event(source, 'dragstart', transfer, source.getBoundingClientRect().left + 15); return transfer; };
  const end = (source, transfer) => event(source, 'dragend', transfer, 0);
  const drop = async (source, anchor, side) => {
    const transfer = begin(source), r = anchor.getBoundingClientRect(), x = side === 'before' ? r.left + 1 : r.right - 1;
    event(rail(), 'dragover', transfer, x);
    check(anchor.dataset.dropSide === side, 'Insertion marker missing');
    check(win.getComputedStyle(anchor, '::after').width === '2px', 'Insertion marker lost its geometry');
    event(rail(), 'drop', transfer, x); end(source, transfer);
  };
  const restore = async () => {
    for (let i = 1; i < original.length; i++) {
      const result = await session().catalog.move(original[i], { anchor: original[i - 1], side: 'after' });
      check(result.ok, 'Could not restore original order');
    }
  };
  check(original.length >= 3, 'Prepare at least three subvaults in Debug-Vault');
  try {
    await run('backward and forward drop preserve selection, DOM identity, focus and file tree', async () => {
      const initialButtons = buttons(), source = initialButtons.at(-1), first = initialButtons[0];
      const header = view.containerEl.querySelector('.sv-header');
      const contents = [...view.navFileContainerEl.children], scroll = view.navFileContainerEl.scrollTop;
      source.focus({ preventScroll: true });
      await drop(source, first, 'before');
      const expected = [original.at(-1), ...original.slice(0, -1)];
      await waitFor(() => equal(order(), expected));
      check(equal(buttons().map(b => b.dataset.subvaultId), expected), 'DOM order differs from catalog');
      check(initialButtons.every(b => buttons().includes(b)), 'Switcher nodes were replaced');
      check(doc.activeElement === source, 'Moved button lost focus');
      check(equal(session().navigation.selection, selection), 'Drag switched the view');
      check(view.containerEl.querySelector('.sv-header') === header && contents.every((el, i) => view.navFileContainerEl.children[i] === el), 'File navigation changed');
      check(view.navFileContainerEl.scrollTop === scroll, 'File tree scrolled');
      await drop(source, buttons().at(-1), 'after');
      await waitFor(() => equal(order(), original));
    });
    await run('cancellation and leaving the rail clear the marker without saving', async () => {
      const before = order(), source = buttons()[0], transfer = begin(source);
      event(rail(), 'dragover', transfer, rail().getBoundingClientRect().right - 1);
      event(rail(), 'dragleave', transfer, 0);
      check(!rail().querySelector('[data-drop-side]'), 'Marker survived leaving the rail');
      end(source, transfer);
      check(!rail().querySelector('.sv-dragging') && equal(order(), before), 'Cancelled drag changed order or kept styling');
    });
    await run('drag clears visible and pending tooltips, suppresses re-entry and restores hover', async () => {
      const source = buttons()[0], other = buttons()[1];
      const labels = [source, other].map(button => button.getAttribute('aria-label'));
      const delays = [source, other].map(button => button.getAttribute('data-tooltip-delay'));
      const hover = button => button.dispatchEvent(new win.Event('pointerover', { bubbles: true }));
      const leave = button => button.dispatchEvent(new win.Event('pointerout', { bubbles: true }));
      const shown = () => [...doc.querySelectorAll('.tooltip')].some(el => labels.includes(el.textContent));
      const delay = ms => new Promise(resolve => win.setTimeout(resolve, ms));
      let transfer;
      try {
        for (const button of [source, other]) button.setAttribute('data-tooltip-delay', '80');
        hover(source); await waitFor(shown);
        transfer = begin(source);
        check(!shown(), 'Visible source tooltip survived drag start');
        event(rail(), 'dragleave', transfer, 0);
        hover(other); await delay(120);
        check(!shown(), 'A switcher tooltip appeared during drag');
        end(source, transfer);
        hover(other); await waitFor(shown); leave(other);
        await delay(120);
        hover(source);
        check(!shown(), 'Expected a pending delayed tooltip');
        transfer = begin(source); await delay(120);
        check(!shown(), 'Pending tooltip appeared after drag start');
        end(source, transfer);
        hover(source); await waitFor(shown);
        check([source, other].every((button, i) => button.getAttribute('aria-label') === labels[i]), 'Drag changed accessible labels');
      } finally {
        if (transfer) end(source, transfer);
        leave(source);
        [source, other].forEach((button, i) => { if (delays[i] === null) button.removeAttribute('data-tooltip-delay'); else button.setAttribute('data-tooltip-delay', delays[i]); });
      }
    });
    await run('fixed controls and external file drops do not reorder or switch views', async () => {
      const strip = rail().parentElement, fixed = [...strip.children].filter(el => el.tagName === 'BUTTON');
      check(fixed.length === 2 && fixed.every(button => !button.draggable), 'All or Create is draggable');
      const before = order(), transfer = new win.DataTransfer(); transfer.setData('text/plain', 'Projects/Alpha/Note.md');
      const over = event(rail(), 'dragover', transfer, 100), dropped = event(rail(), 'drop', transfer, 100);
      check(!over.defaultPrevented && !dropped.defaultPrevented, 'External drag was accepted');
      check(equal(order(), before) && equal(session().navigation.selection, selection), 'External drop changed plugin state');
    });
    await run('narrow rail scrolls to hidden targets and stops scrolling after cancellation', async () => {
      const strip = rail().parentElement, previousWidth = strip.style.width;
      try {
        strip.style.width = '140px'; rail().scrollLeft = 0;
        check(rail().scrollWidth > rail().clientWidth, 'Rail did not overflow');
        const source = buttons()[0], transfer = begin(source), r = rail().getBoundingClientRect();
        event(rail(), 'dragover', transfer, r.right - 1);
        await waitFor(() => rail().scrollLeft >= rail().scrollWidth - rail().clientWidth - 1);
        check(buttons().at(-1).dataset.dropSide === 'after', 'Hidden last target is inaccessible');
        const reached = rail().scrollLeft;
        end(source, transfer);
        await new Promise(resolve => win.setTimeout(resolve, 60));
        check(rail().scrollLeft === reached && !rail().querySelector('[data-drop-side]'), 'Edge scrolling continued after cancellation');
        rail().scrollLeft = rail().scrollWidth;
        const backwards = begin(buttons().at(-1));
        event(rail(), 'dragover', backwards, r.left + 1);
        await waitFor(() => rail().scrollLeft === 0);
        end(buttons().at(-1), backwards);
      } finally { strip.style.width = previousWidth; }
    });
    await run('failed drop preserves committed order and reports an error', async () => {
      await session().navigation.flush();
      const plugin = app.plugins.plugins.subvaults, save = plugin.saveData, before = order();
      const existingNotices = new Set(doc.querySelectorAll('.notice'));
      plugin.saveData = async () => { throw new Error('Injected reorder save failure'); };
      try {
        await drop(buttons().at(-1), buttons()[0], 'before');
        await waitFor(() => [...doc.querySelectorAll('.notice')].some(el => !existingNotices.has(el) && el.textContent.includes('Could not save Subvaults data')));
        check(equal(order(), before) && equal(buttons().map(b => b.dataset.subvaultId), before), 'Failed save changed order');
      } finally {
        plugin.saveData = save;
        for (const notice of doc.querySelectorAll('.notice')) if (!existingNotices.has(notice)) notice.click();
      }
    });
    await run('saved order survives plugin reload and retains the selected subvault', async () => {
      const expected = [original.at(-1), ...original.slice(0, -1)];
      await drop(buttons().at(-1), buttons()[0], 'before');
      await waitFor(() => equal(order(), expected));
      await session().navigation.flush();
      await app.plugins.disablePlugin('subvaults');
      check(!view.containerEl.querySelector('.sv-switcher'), 'Switcher survived unload');
      await app.plugins.enablePlugin('subvaults');
      check(equal(order(), expected) && equal(buttons().map(b => b.dataset.subvaultId), expected), 'Reload lost saved order');
      check(equal(session().navigation.selection, selection), 'Reload lost selection');
    });
  } finally { await restore(); rail().scrollLeft = originalScroll; }
  console.log('Reorder verification:', results.filter(r => r.passed).length, '/', results.length, report);
  return { report, passed: results.every(r => r.passed), failures: results.filter(r => !r.passed) };
};
