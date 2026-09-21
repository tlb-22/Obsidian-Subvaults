/** 持有创建交互草稿与原生风格单选树，提交业务意图并局部更新控件。 */
import { ButtonComponent, Notice, SearchComponent, setIcon, type App } from 'obsidian';
import { AppearancePicker } from '../Presentation/AppearancePicker';
import { colorValue, labelRegion, tooltip } from '../Presentation/Controls';
import { folderPath, iconId, type Appearance, type FolderPath, type SubvaultId } from './Subvault';
import { visibleFolders } from './FolderChoices';
import type { SubvaultCatalog } from './SubvaultCatalog';
import { failureMessage } from './SubvaultFeedback';

type Form = { readonly kind: 'editing'; readonly root: FolderPath | null; readonly appearance: Appearance } | { readonly kind: 'saving'; readonly root: FolderPath; readonly appearance: Appearance };
interface RowElements { readonly el: HTMLDivElement; readonly disclosure: HTMLSpanElement }
export class CreatePanel {
  private form: Form = { kind: 'editing', root: null, appearance: { icon: iconId('folder'), color: 'default' } };
  private query = '';
  private readonly expanded = new Set<FolderPath>();
  private readonly rows = new Map<FolderPath, RowElements>();
  private readonly picker = new AppearancePicker();
  private readonly panel: HTMLDivElement;
  private readonly tree: HTMLDivElement;
  private readonly error: HTMLDivElement;
  private readonly icon: HTMLButtonElement;
  private readonly color: HTMLButtonElement;
  private readonly iconImage: HTMLElement;
  private readonly colorImage: HTMLElement;
  private readonly create: ButtonComponent;
  private readonly cancel: ButtonComponent;
  private readonly previousFocus: HTMLElement | null;
  private readonly covered: { el: HTMLElement; inert: boolean }[];
  private readonly unsubscribe: () => void;
  private closed = false;
  constructor(private readonly app: App, private readonly catalog: SubvaultCatalog, host: HTMLElement, private readonly done: (created?: SubvaultId) => void) {
    this.previousFocus = host.ownerDocument.activeElement as HTMLElement | null;
    this.covered = Array.from(host.children).filter((el): el is HTMLElement => el instanceof host.ownerDocument.defaultView!.HTMLElement).map(el => ({ el, inert: el.inert }));
    for (const item of this.covered) item.el.inert = true;
    this.panel = host.createDiv({ cls: 'sv-ui sv-create-panel', attr: { role: 'dialog' } });
    labelRegion(this.panel, 'Create subvault');
    const actions = this.panel.createDiv('sv-create-appearance');
    this.icon = new ButtonComponent(actions).onClick(() => this.picker.icon(this.icon, this.form.appearance.icon, icon => this.setAppearance({ ...this.form.appearance, icon }))).buttonEl;
    this.icon.classList.add('sv-button');
    this.iconImage = this.icon.createSpan();
    this.icon.createSpan({ text: 'Icon' });
    tooltip(this.icon, 'Icon');
    this.color = new ButtonComponent(actions).onClick(() => this.picker.color(this.color, this.form.appearance.color, color => this.setAppearance({ ...this.form.appearance, color }))).buttonEl;
    this.color.classList.add('sv-button');
    this.colorImage = this.color.createSpan(); setIcon(this.colorImage, 'palette');
    this.color.createSpan({ text: 'Color' });
    tooltip(this.color, 'Color');
    const folders = this.panel.createDiv('sv-folder-picker');
    const search = new SearchComponent(folders.createDiv('sv-folder-search')).setPlaceholder('Search folders…').onChange(query => { this.query = query; this.renderTree(); });
    labelRegion(search.inputEl, 'Search folders', folders);
    this.tree = folders.createDiv({ cls: 'sv-folder-tree', attr: { role: 'tree' } });
    labelRegion(this.tree, 'Working folder', folders);
    this.error = this.panel.createDiv({ cls: 'sv-inline-error', attr: { role: 'alert' } });
    const footer = this.panel.createDiv('sv-create-footer');
    this.cancel = new ButtonComponent(footer).setButtonText('Cancel').onClick(() => this.done());
    this.cancel.buttonEl.classList.add('sv-button');
    this.create = new ButtonComponent(footer).setButtonText('Create').onClick(() => { void this.submit(); });
    this.create.buttonEl.classList.add('sv-button', 'sv-primary');
    this.panel.addEventListener('keydown', event => { if (event.key === 'Escape' && this.form.kind === 'editing') { event.preventDefault(); event.stopPropagation(); this.done(); } });
    this.unsubscribe = catalog.subscribe(() => this.refresh());
    this.refresh(); search.inputEl.focus();
  }
  private setAppearance(appearance: Appearance): void { if (this.form.kind === 'editing') { this.form = { ...this.form, appearance }; this.renderControls(); } }
  private renderControls(): void {
    if (this.icon.dataset.icon !== this.form.appearance.icon) { setIcon(this.iconImage, this.form.appearance.icon); this.icon.dataset.icon = this.form.appearance.icon; }
    this.iconImage.style.color = this.colorImage.style.color = colorValue[this.form.appearance.color];
    const busy = this.form.kind === 'saving';
    this.icon.disabled = this.color.disabled = busy;
    this.tree.inert = busy;
    this.cancel.setDisabled(busy);
    this.create.setDisabled(busy || !this.form.root || !this.app.vault.getFolderByPath(this.form.root) || this.catalog.items.some(s => s.root === this.form.root));
  }
  refresh(): void { if (!this.closed) { this.renderControls(); this.renderTree(); } }
  private select(path: FolderPath): void {
    if (this.form.kind !== 'editing' || this.catalog.items.some(s => s.root === path)) return;
    this.form = { ...this.form, root: path }; this.error.textContent = ''; this.renderControls(); this.renderTree();
  }
  private renderTree(): void {
    const paths = this.app.vault.getAllFolders().map(folder => folderPath(folder.path));
    const visible = visibleFolders(paths, this.expanded, this.query), keep = new Set(visible.map(row => row.path));
    for (const [path, row] of this.rows) if (!keep.has(path)) { row.el.remove(); this.rows.delete(path); }
    let cursor = this.tree.firstElementChild;
    for (const model of visible) {
      let row = this.rows.get(model.path);
      if (!row) {
        const el = this.tree.ownerDocument.createElement('div');
        el.className = 'sv-folder-row';
        el.setAttribute('role', 'treeitem'); el.tabIndex = 0; el.dataset.svFolder = model.path;
        const disclosure = el.createSpan('sv-folder-toggle');
        setIcon(disclosure, 'chevron-right');
        const icon = el.createSpan('sv-folder-icon'); setIcon(icon, 'folder');
        el.createSpan({ cls: 'sv-folder-name', text: model.name });
        const toggle = () => { if (this.expanded.has(model.path)) this.expanded.delete(model.path); else this.expanded.add(model.path); this.renderTree(); };
        disclosure.addEventListener('click', e => { e.stopPropagation(); toggle(); });
        el.addEventListener('click', () => this.select(model.path));
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(model.path); }
          if (e.key === 'ArrowRight' && !this.expanded.has(model.path)) { e.preventDefault(); toggle(); }
          if (e.key === 'ArrowLeft' && this.expanded.has(model.path)) { e.preventDefault(); toggle(); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const next = e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling; (next as HTMLElement | null)?.focus(); }
        });
        row = { el, disclosure }; this.rows.set(model.path, row);
      }
      const selected = this.form.root === model.path, bound = this.catalog.items.some(s => s.root === model.path);
      row.el.setAttribute('aria-selected', String(selected)); row.el.setAttribute('aria-disabled', String(bound));
      row.el.style.setProperty('--sv-depth', String(model.depth));
      row.disclosure.style.visibility = model.hasChildren ? 'visible' : 'hidden';
      row.disclosure.classList.toggle('sv-collapsed', !this.expanded.has(model.path) && !this.query);
      if (model.hasChildren) row.el.setAttribute('aria-expanded', String(this.expanded.has(model.path) || !!this.query));
      tooltip(row.el, bound ? `${model.path}\nAlready has a subvault` : model.path);
      if (cursor !== row.el) this.tree.insertBefore(row.el, cursor); else cursor = cursor.nextElementSibling;
    }
  }
  private async submit(): Promise<void> {
    if (this.form.kind !== 'editing' || !this.form.root) return;
    this.form = { ...this.form, kind: 'saving', root: this.form.root }; this.renderControls();
    const result = await this.catalog.create(this.form.root, this.form.appearance);
    if (this.closed) return;
    if (result.ok) { new Notice('Subvault created.'); this.done(result.value); }
    else { this.form = { ...this.form, kind: 'editing' }; this.error.textContent = failureMessage(result.error); this.renderControls(); }
  }
  dispose(): void {
    this.closed = true; this.unsubscribe(); this.picker.close(); this.panel.remove();
    for (const item of this.covered) item.el.inert = item.inert;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }
}
