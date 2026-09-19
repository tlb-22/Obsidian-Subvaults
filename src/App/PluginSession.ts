/** 集中装配业务能力与生产适配器，拥有插件会话中的订阅和清理顺序。 */
import { Component, Notice, TFolder, type App } from 'obsidian';
import { PluginPersistence } from '../Persistence/PluginPersistence';
import type { PluginDocument } from '../Persistence/PluginDocument';
import { SubvaultCatalog } from '../Subvaults/SubvaultCatalog';
import { subvaultId } from '../Subvaults/Subvault';
import { failureMessage } from '../Subvaults/SubvaultFeedback';
import { NavigationSession } from '../FileNavigation/NavigationSession';
import { ExplorerCoordinator } from '../FileNavigation/ExplorerCoordinator';

export class PluginSession extends Component {
  readonly catalog: SubvaultCatalog;
  readonly navigation: NavigationSession;
  private readonly explorer: ExplorerCoordinator;
  private readonly persistence: PluginPersistence;
  constructor(private readonly app: App, initial: PluginDocument, write: (value: PluginDocument) => Promise<void>) {
    super();
    this.persistence = new PluginPersistence(initial, write);
    this.catalog = new SubvaultCatalog(initial.subvaults, this.persistence, path => app.vault.getFolderByPath(path) !== null, () => subvaultId(crypto.randomUUID()));
    this.navigation = new NavigationSession(initial.navigation, state => this.persistence.saveNavigation(state), this.report);
    this.navigation.reconcile(this.catalog.items);
    this.explorer = new ExplorerCoordinator(app, this.catalog, this.navigation, this.report);
  }
  private readonly report = (error: unknown): void => { console.error('Subvaults:', error); new Notice(`Subvaults: ${error instanceof Error ? error.message : 'An operation failed.'}`, 0); };
  override onload(): void {
    const update = () => this.explorer.update();
    this.register(this.catalog.subscribe(() => { this.navigation.reconcile(this.catalog.items); update(); void this.navigation.flush().catch(this.report); }));
    this.register(this.navigation.subscribe(update));
    this.registerEvent(this.app.workspace.on('layout-change', update));
    this.registerEvent(this.app.workspace.on('file-open', update));
    this.registerEvent(this.app.vault.on('create', update));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFolder) void this.catalog.observe({ kind: 'rename', oldPath, path: file.path }).then(result => { if (!result.ok) this.report(new Error(failureMessage(result.error))); });
      update();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      if (file instanceof TFolder) void this.catalog.observe({ kind: 'delete', path: file.path }).then(result => { if (!result.ok) this.report(new Error(failureMessage(result.error))); });
      update();
    }));
    for (const s of this.catalog.items) if (!this.app.vault.getFolderByPath(s.root)) void this.catalog.observe({ kind: 'delete', path: s.root }).then(result => { if (!result.ok) this.report(new Error(failureMessage(result.error))); });
    update();
  }
  override onunload(): void { this.explorer.dispose(); }
}
