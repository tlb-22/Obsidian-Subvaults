/** 在 Debug-Vault 临时加载主题，检查真实控件的布局、颜色和交互；结束后恢复显示状态。 */
module.exports = async (app, themes = []) => {
  require('./debug-vault.cjs')(app);
  const { writeFileSync } = require('node:fs');
  const { join } = require('node:path');
  const { directories } = require('../../scripts/artifact-run.cjs')('appearance-verification', ['tests']);
  const report = join(directories.tests, 'results.json');
  const view = app.workspace.getLeavesOfType('file-explorer')[0].view;
  const doc = view.containerEl.ownerDocument, win = doc.defaultView;
  const originalClasses = doc.body.className;
  const theme = doc.head.createEl('style');
  const session = () => app.plugins.plugins.subvaults._children.find(child => child.catalog && child.navigation);
  const originalSelection = session().navigation.selection;
  const results = [], baseline = new Map();
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const style = el => win.getComputedStyle(el);
  const rect = el => el.getBoundingClientRect();
  const color = (parent, value) => {
    const probe = parent.createSpan(); probe.style.color = value;
    const result = style(probe).color; probe.remove(); return result;
  };
  const closePanel = () => view.containerEl.querySelector('.sv-create-footer button')?.click();
  try {
    closePanel();
    await app.plugins.disablePlugin('subvaults');
    await app.plugins.enablePlugin('subvaults');
    doc.head.append(theme);
    for (const candidate of [{ name: 'Default', css: '' }, ...themes]) {
      for (const mode of ['theme-light', 'theme-dark']) {
        theme.textContent = candidate.css;
        doc.body.classList.remove('theme-light', 'theme-dark'); doc.body.classList.add(mode);
        for (const width of [140, 180, 240, 320]) {
          const entry = { theme: candidate.name, mode, width, passed: false };
          const strip = view.containerEl.querySelector('.sv-switcher');
          const stripWidth = strip.style.width;
          try {
            strip.style.width = `${width}px`;
            const buttons = [...strip.querySelectorAll('button')];
            const selected = session().catalog.items[0];
            session().navigation.switchTo({ kind: 'subvault', id: selected.id });
            for (const button of buttons) {
              check(Math.abs(rect(button).width - 30) < 1 && Math.abs(rect(button).height - 30) < 1, 'Switcher button changed size');
              check(Math.abs(rect(button.querySelector('svg')).width - 20) < 1, 'Switcher icon changed size');
              check(style(button.querySelector('svg')).color === style(button).color, 'Theme replaced the identity color');
            }
            const active = strip.querySelector('[aria-pressed="true"]');
            check(style(active).boxShadow.includes('inset'), 'Selected view lost its underline');
            check(rect(buttons.at(-1)).right <= rect(strip).right + 1, 'Create entry escaped narrow switcher');
            const external = view.navFileContainerEl.querySelector('.sv-external > .tree-item-self');
            check(external, 'Open a file outside Projects before appearance verification');
            const wrapper = external.parentElement, originalRowClass = external.className;
            try {
              external.classList.add('is-active');
              const actual = style(external).color;
              wrapper.classList.remove('sv-external');
              check(actual === style(external).color, 'External file overrides native selected text color');
            } finally { wrapper.classList.add('sv-external'); external.className = originalRowClass; }
            buttons.at(-1).click();
            const panel = view.containerEl.querySelector('.sv-create-panel'); panel.style.width = `${width}px`;
            const footer = panel.querySelector('.sv-create-footer');
            const create = footer.querySelector('.sv-primary');
            check(create.disabled, 'Create is enabled without a folder');
            panel.querySelector('.sv-folder-row[aria-disabled="false"]').click();
            check(!create.disabled, 'Valid folder did not enable Create');
            check(style(create).backgroundColor === color(panel, 'var(--interactive-accent)'), 'Create lost theme accent');
            check(style(create).color === color(panel, 'var(--text-on-accent)'), 'Create has incorrect foreground');
            const radius = style(create).borderRadius;
            for (const el of panel.querySelectorAll('button, input[type="search"], .sv-folder-picker, .sv-folder-row')) {
              check(style(el).borderRadius === radius, `Inconsistent radius on ${el.className}`);
            }
            const geometry = [];
            for (const row of [panel.querySelector('.sv-create-appearance'), footer]) {
              const [first, second] = [...row.querySelectorAll('button')];
              check(Math.abs(rect(first).width - rect(second).width) < 1, 'Buttons have unequal widths');
              check(Math.abs(rect(first).height - 36) < 1 && Math.abs(rect(second).height - 36) < 1, 'Action row changed height');
              check(row.scrollWidth <= row.clientWidth, 'Action row overflows');
              geometry.push(Number(rect(first).width.toFixed(2)));
            }
            check(geometry[0] === geometry[1], 'Top and bottom actions do not align');
            const actions = [...panel.querySelectorAll('.sv-create-appearance button')];
            for (const button of actions) {
              const icon = rect(button.querySelector('svg'));
              check(icon.width === 20 && icon.height === 20, 'Appearance icon was squeezed');
              check(button.scrollWidth <= button.clientWidth, 'Button label escapes narrow panel');
            }
            for (const [index, count, columns] of [[0, 49, 7], [1, 12, 6]]) {
              actions[index].click();
              const picker = doc.querySelector('.sv-picker'), grid = picker.querySelector('.sv-picker-grid');
              const cells = [...grid.querySelectorAll('button')];
              check(cells.length === count, 'Picker choices are incomplete');
              check(style(grid).gridTemplateColumns.split(' ').length === columns, 'Picker column count changed');
              check(style(picker).borderRadius === radius, 'Popup radius differs from controls');
              check(rect(picker).left >= 0 && rect(picker).right <= doc.documentElement.clientWidth + 1, 'Popup escapes viewport horizontally');
              check(rect(picker).top >= 0 && rect(picker).bottom <= doc.documentElement.clientHeight + 1, 'Popup escapes viewport vertically');
              for (const cell of cells) {
                check(Math.abs(rect(cell).width - rect(cell).height) < 1, 'Picker cell is not square');
                check(style(cell).borderRadius === radius, 'Picker cell radius differs');
              }
              if (index === 1) {
                const rings = cells.map(cell => cell.querySelector('.sv-color-ring'));
                check(new Set(rings.map(ring => style(ring).color)).size === 12, 'Palette colors collapsed together');
                check(rings.every(ring => rect(ring).width === 20 && style(ring).borderRadius === '50%'), 'Color ring geometry changed');
              }
              cells[0].focus();
              cells[0].dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
              check(doc.activeElement === cells[columns], 'Picker keyboard navigation lost columns');
              cells.at(-1).click();
              check(!doc.querySelector('.sv-picker'), 'Picker did not close after selection');
              check(doc.activeElement === actions[index], 'Selection did not restore anchor focus');
            }
            // 比较同一宽度的布局；主题只改变语义配色与统一圆角。
            const key = String(width), signature = JSON.stringify(geometry.slice(0, 2));
            if (baseline.has(key)) check(baseline.get(key) === signature, 'Action layout differs between themes');
            else baseline.set(key, signature);
            entry.passed = true; entry.radius = radius; entry.buttonWidth = geometry[0];
          } catch (error) { entry.error = String(error); }
          finally { closePanel(); strip.style.width = stripWidth; }
          results.push(entry);
          writeFileSync(report, JSON.stringify({ time: new Date().toISOString(), results }, null, 2));
        }
      }
    }
  } finally {
    closePanel(); theme.remove(); doc.body.className = originalClasses;
    session().navigation.switchTo(originalSelection);
  }
  console.log('Appearance verification:', results.filter(r => r.passed).length, '/', results.length, report);
  return { report, passed: results.every(r => r.passed), failures: results.filter(r => !r.passed) };
};
