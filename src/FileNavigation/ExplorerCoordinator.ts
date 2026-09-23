/** 协调各原生文件导航实例与业务状态，稳定持有界面并管理滚动和事件资源。 */
import { FileView, type App, type WorkspaceLeaf } from 'obsidian';
import type { SubvaultCatalog } from '../Subvaults/SubvaultCatalog';
import { CreatePanel } from '../Subvaults/CreatePanel';
import { SubvaultMenu } from '../Subvaults/SubvaultMenu';
import { failureMessage } from '../Subvaults/SubvaultFeedback';
import { outsideFiles, sameSelection, type Selection } from './NavigationState';
import type { NavigationSession } from './NavigationSession';
import { NativeExplorer, type ExplorerScope } from './NativeExplorer';
import { ExplorerChrome } from './ExplorerChrome';

class ExplorerPane {
  private readonly native: NativeExplorer;
  private readonly chrome: ExplorerChrome;
  private readonly menu: SubvaultMenu;
  private panel: CreatePanel | null = null;
  private shown: Selection | null = null;
  private scopeKey = '';
  private timer: number | null = null;
  private readonly scroll: () => void;
  constructor(private readonly app: App, readonly leaf: WorkspaceLeaf, private readonly catalog: SubvaultCatalog, private readonly navigation: NavigationSession, private readonly report: (error: unknown) => void) {
    this.native = new NativeExplorer(app, leaf, report);
    this.native.container.addClass('sv-explorer');
    this.menu = new SubvaultMenu(catalog);
    try {
      this.chrome = new ExplorerChrome(this.native.container, this.native.scrollContainer,
        s => navigation.switchTo(s), () => this.create(), (e, button, id) => this.menu.open(e, button, id),
        (id, position) => { void catalog.move(id, position).then(result => { if (!result.ok) report(new Error(failureMessage(result.error))); }).catch(report); });
    }
    catch (error) { this.menu.dispose(); this.native.dispose(); this.native.container.removeClass('sv-explorer'); throw error; }
    this.scroll = () => {
      if (!this.shown || this.native.scrollContainer.clientHeight === 0) return;
      this.navigation.remember(this.shown, this.native.scrollContainer.scrollTop);
      const win = this.native.container.ownerDocument.defaultView!;
      if (this.timer !== null) win.clearTimeout(this.timer);
      this.timer = win.setTimeout(() => { this.timer = null; void navigation.flush().catch(report); }, 180);
    };
    this.native.scrollContainer.addEventListener('scroll', this.scroll, { passive: true });
  }
  update(openPaths: readonly string[]): void {
    const selection = this.navigation.selection;
    const changed = this.shown === null || !sameSelection(this.shown, selection);
    if (changed && this.shown && this.native.scrollContainer.clientHeight > 0) this.navigation.remember(this.shown, this.native.scrollContainer.scrollTop);
    this.shown = selection;
    const current = selection.kind === 'subvault' ? this.catalog.items.find(s => s.id === selection.id) : undefined;
    if (selection.kind === 'subvault' && !current) throw new Error('Selected subvault is unavailable');
    const scope: ExplorerScope = current ? { kind: 'folder', root: current.root, external: outsideFiles(current.root, openPaths) } : { kind: 'all' };
    const key = JSON.stringify(scope);
    this.chrome.update(this.catalog.items, selection);
    if (this.scopeKey !== key) { this.scopeKey = key; this.native.setScope(scope); }
    if (changed) this.native.restoreScroll(this.navigation.position(selection));
    this.panel?.refresh();
  }
  private create(): void {
    if (this.panel) return;
    this.panel = new CreatePanel(this.app, this.catalog, this.native.container, id => {
      this.panel?.dispose(); this.panel = null;
      if (id) this.navigation.switchTo({ kind: 'subvault', id });
    });
  }
  dispose(): void {
    if (this.shown && this.native.scrollContainer.clientHeight > 0) this.navigation.remember(this.shown, this.native.scrollContainer.scrollTop);
    this.native.scrollContainer.removeEventListener('scroll', this.scroll);
    if (this.timer !== null) this.native.container.ownerDocument.defaultView!.clearTimeout(this.timer);
    this.panel?.dispose(); this.menu.dispose(); this.chrome.dispose(); this.native.dispose(); this.native.container.removeClass('sv-explorer');
    void this.navigation.flush().catch(this.report);
  }
}
export class ExplorerCoordinator {
  private readonly panes = new Map<WorkspaceLeaf, ExplorerPane>();
  constructor(private readonly app: App, private readonly catalog: SubvaultCatalog, private readonly navigation: NavigationSession, private readonly report: (error: unknown) => void) {}
  update(): void {
    // Background leaves may still hold a DeferredView; layout-change runs again after native loading.
    const leaves = new Set(this.app.workspace.getLeavesOfType('file-explorer').filter(leaf => !leaf.isDeferred));
    for (const [leaf, pane] of this.panes) if (!leaves.has(leaf)) { pane.dispose(); this.panes.delete(leaf); }
    for (const leaf of leaves) if (!this.panes.has(leaf)) {
      this.panes.set(leaf, new ExplorerPane(this.app, leaf, this.catalog, this.navigation, this.report));
    }
    const paths: string[] = [];
    this.app.workspace.iterateAllLeaves(leaf => {
      const path = leaf.view instanceof FileView ? leaf.view.file?.path : leaf.getViewState().state?.file;
      if (typeof path === 'string' && this.app.vault.getFileByPath(path)) paths.push(path);
    });
    for (const pane of this.panes.values()) pane.update(paths);
  }
  dispose(): void { for (const pane of this.panes.values()) pane.dispose(); this.panes.clear(); }
}
