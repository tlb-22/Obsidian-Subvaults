/** 隔离 Obsidian 1.13 文件导航内部接口，复用原生条目、排序、定位及新建行为。 */
import { Keymap, Menu, setTooltip, type App, type TAbstractFile, type TFolder, type View, type WorkspaceLeaf } from 'obsidian';
import { containsPath, type FolderPath } from '../Subvaults/Subvault';

interface NativeItem { readonly file: TAbstractFile; readonly el: HTMLElement; readonly selfEl: HTMLElement }
interface ExplorerView extends View {
  readonly navFileContainerEl: HTMLElement;
  readonly fileItems: Record<string, NativeItem>;
  readonly tree: { setFocusedItem(item: NativeItem | null): void; readonly infinityScroll: { compute(): void; scrollIntoView(item: NativeItem, margin: number): void } };
  readonly activeDom: NativeItem | null;
  getSortedFolderItems(folder: TFolder): NativeItem[];
  sort(): void;
  revealActiveFile(): void;
  revealInFolder(file: TAbstractFile): void;
  onFileContextMenu(event: MouseEvent, file: TAbstractFile): void;
  onFilePointerover(event: PointerEvent, title: HTMLElement): void;
  createAbstractFile(kind: 'file' | 'folder', parent: TFolder | null, leaf: boolean | 'tab' | 'split' | 'window'): Promise<void>;
}
export type ExplorerScope = { readonly kind: 'all' } | { readonly kind: 'folder'; readonly root: FolderPath; readonly external: readonly string[] };
function inspect(view: View): ExplorerView {
  const candidate = view as Partial<ExplorerView>;
  if (typeof candidate.getSortedFolderItems !== 'function' || typeof candidate.sort !== 'function' || typeof candidate.createAbstractFile !== 'function' || typeof candidate.onFileContextMenu !== 'function' || typeof candidate.onFilePointerover !== 'function' || typeof candidate.revealActiveFile !== 'function' || typeof candidate.revealInFolder !== 'function' || !candidate.navFileContainerEl || !candidate.fileItems || !candidate.tree?.infinityScroll) {
    throw new Error('This Obsidian file explorer is not supported. Subvaults requires the desktop 1.13 file explorer.');
  }
  return candidate as ExplorerView;
}

export class NativeExplorer {
  readonly view: ExplorerView;
  private scope: ExplorerScope = { kind: 'all' };
  private refreshing = false;
  private live = true;
  private readonly restore: (() => void)[] = [];
  private readonly observer: MutationObserver;
  private readonly decorated = new Set<HTMLElement>();
  private readonly originalLabels = new Map<HTMLElement, string | null>();
  private contextMenu: Menu | null = null;
  constructor(private readonly app: App, readonly leaf: WorkspaceLeaf, private readonly report: (error: unknown) => void) {
    this.view = inspect(leaf.view);
    const v = this.view;
    const buttons = v.containerEl.querySelectorAll<HTMLElement>('.nav-header .nav-action-button');
    const newNote = buttons[0], newFolder = buttons[1];
    if (!newNote || !newFolder) throw new Error('The native file creation controls are unavailable.');
    this.wrap('getSortedFolderItems', original => folder => {
      if (this.scope.kind === 'all') return original(folder);
      if (folder.isRoot()) {
        const root = this.root();
        if (!root) return [];
        const internal = original(root);
        const external = this.scope.external.flatMap(path => v.fileItems[path] ? [v.fileItems[path]!] : []);
        return [...internal, ...external];
      }
      return containsPath(this.scope.root, folder.path) ? original(folder) : [];
    });
    this.wrap('onFileContextMenu', original => (event, file) => {
      if (this.scope.kind !== 'folder' || file !== this.app.vault.getRoot()) return original(event, file);
      const root = this.requireRoot(), menu = new Menu();
      this.contextMenu?.hide(); this.contextMenu = menu;
      menu.addItem(item => item.setTitle('New note').setIcon('file-plus').onClick(e => { void v.createAbstractFile('file', root, Keymap.isModEvent(e) || 'tab').catch(report); }));
      menu.addItem(item => item.setTitle('New folder').setIcon('folder-plus').onClick(() => { void v.createAbstractFile('folder', root, false).catch(report); }));
      this.app.workspace.trigger('file-menu', menu, root, 'file-explorer-context-menu', null);
      menu.showAtMouseEvent(event);
    });
    this.wrap('onFilePointerover', original => (event, title) => {
      const path = title.dataset.path;
      if (this.scope.kind !== 'folder' || !path || !this.scope.external.includes(path)) return original(event, title);
      // The public tooltip uses the path label; preserve the native hover-preview integration.
      if (event.pointerType !== 'touch' && !title.contains(event.relatedTarget as Node | null)) {
        this.app.workspace.trigger('hover-link', { event, source: 'file-explorer', hoverParent: v, targetEl: title, linktext: path });
      }
    });
    this.wrap('revealActiveFile', original => () => {
      if (this.refreshing) return;
      const item = v.activeDom;
      if (this.scope.kind === 'folder' && item && !containsPath(this.scope.root, item.file.path)) {
        this.refresh();
        v.tree.infinityScroll.scrollIntoView(item, 4);
      } else original();
    });
    this.wrap('revealInFolder', original => file => {
      if (this.scope.kind === 'folder' && !containsPath(this.scope.root, file.path)) {
        this.refresh();
        const item = v.fileItems[file.path];
        if (item) { v.tree.setFocusedItem(item); v.tree.infinityScroll.scrollIntoView(item, 4); this.app.workspace.setActiveLeaf(leaf); }
      } else original(file);
    });
    const create = (event: MouseEvent) => {
      if (this.scope.kind !== 'folder') return;
      const target = event.target as Node;
      const kind = newNote.contains(target) ? 'file' : newFolder.contains(target) ? 'folder' : null;
      if (!kind) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void v.createAbstractFile(kind, this.requireRoot(), kind === 'file' ? Keymap.isModEvent(event) || 'tab' : false).catch(report);
    };
    v.containerEl.addEventListener('click', create, true);
    this.restore.push(() => v.containerEl.removeEventListener('click', create, true));
    const win = v.containerEl.ownerDocument.defaultView!;
    this.observer = new win.MutationObserver(() => this.decorate());
    this.observer.observe(v.navFileContainerEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-path'] });
    const relayDrop = (event: DragEvent) => {
      if (this.scope.kind !== 'folder' || event.defaultPrevented || (event.target as HTMLElement).closest('.tree-item')) return;
      const item = v.fileItems[this.scope.root];
      if (!item) return;
      const relay = new win.DragEvent(event.type, { bubbles: false, cancelable: true, dataTransfer: event.dataTransfer, clientX: event.clientX, clientY: event.clientY, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey });
      item.el.dispatchEvent(relay);
      if (relay.defaultPrevented) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    for (const type of ['dragover', 'dragenter', 'drop'] as const) {
      v.navFileContainerEl.addEventListener(type, relayDrop, true);
      this.restore.push(() => v.navFileContainerEl.removeEventListener(type, relayDrop, true));
    }
  }
  private wrap<K extends 'getSortedFolderItems' | 'onFileContextMenu' | 'onFilePointerover' | 'revealActiveFile' | 'revealInFolder'>(key: K, factory: (original: ExplorerView[K]) => ExplorerView[K]): void {
    const v = this.view, descriptor = Object.getOwnPropertyDescriptor(v, key), original = v[key];
    const replacement = factory(original.bind(v) as ExplorerView[K]);
    const installed = ((...args: unknown[]) => Reflect.apply(this.live ? replacement : original, v, args)) as ExplorerView[K];
    Object.defineProperty(v, key, { configurable: true, writable: true, value: installed });
    this.restore.push(() => { if (v[key] === installed) { if (descriptor) Object.defineProperty(v, key, descriptor); else Reflect.deleteProperty(v, key); } });
  }
  private root(): TFolder | null { return this.scope.kind === 'folder' ? this.app.vault.getFolderByPath(this.scope.root) : this.app.vault.getRoot(); }
  private requireRoot(): TFolder { const root = this.root(); if (!root) throw new Error('The subvault folder is no longer available.'); return root; }
  get container(): HTMLElement { return this.view.containerEl; }
  get scrollContainer(): HTMLElement { return this.view.navFileContainerEl; }
  setScope(scope: ExplorerScope): void { this.scope = scope; this.refresh(); }
  refresh(): void {
    this.refreshing = true;
    try { this.view.sort(); this.decorate(); }
    finally { this.refreshing = false; }
  }
  restoreScroll(top: number): void { this.scrollContainer.scrollTop = top; this.view.tree.infinityScroll.compute(); this.decorate(); }
  private decorate(): void {
    const external = new Set(this.scope.kind === 'folder' ? this.scope.external : []);
    const first = this.scope.kind === 'folder' ? this.scope.external.find(path => this.view.fileItems[path]) : undefined;
    for (const title of this.originalLabels.keys()) if (!external.has(title.dataset.path!)) this.restoreLabel(title);
    for (const el of this.decorated) {
      const path = el.querySelector('[data-path]')?.getAttribute('data-path');
      if (!path || !external.has(path)) { el.classList.remove('sv-external', 'sv-external-first'); this.decorated.delete(el); }
    }
    for (const title of this.scrollContainer.querySelectorAll<HTMLElement>('.tree-item-self[data-path]')) {
      const path = title.dataset.path!, el = title.parentElement!;
      el.classList.toggle('sv-external', external.has(path));
      el.classList.toggle('sv-external-first', path === first);
      if (external.has(path)) {
        this.decorated.add(el);
        if (!this.originalLabels.has(title)) this.originalLabels.set(title, title.getAttribute('aria-label'));
        if (title.getAttribute('aria-label') !== path) setTooltip(title, path);
      }
    }
  }
  private restoreLabel(title: HTMLElement): void {
    const label = this.originalLabels.get(title);
    if (label === null) title.removeAttribute('aria-label');
    else if (label !== undefined) title.setAttribute('aria-label', label);
    this.originalLabels.delete(title);
  }
  dispose(): void {
    this.live = false; this.observer.disconnect(); this.contextMenu?.hide();
    for (const release of this.restore.reverse()) release();
    for (const el of this.decorated) el.classList.remove('sv-external', 'sv-external-first');
    this.decorated.clear();
    for (const title of this.originalLabels.keys()) this.restoreLabel(title);
    try { this.view.sort(); } catch (error) { this.report(error); }
  }
}
