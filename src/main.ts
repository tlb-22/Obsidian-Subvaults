/** Obsidian 插件入口：恢复配置、等待布局就绪并装配唯一业务会话。 */
import { Notice, Plugin } from 'obsidian';
import { PluginPersistence, type PluginState } from './Persistence/PluginPersistence';
import { PluginSession } from './App/PluginSession';

export default class SubvaultsPlugin extends Plugin {
  private active = false;
  override async onload(): Promise<void> {
    this.active = true;
    const persistence = new PluginPersistence({
      loadData: () => this.loadData(), saveData: data => this.saveData(data),
      loadNavigation: () => this.app.loadLocalStorage('subvaults:navigation'),
      saveNavigation: data => this.app.saveLocalStorage('subvaults:navigation', data),
    });
    let initial: PluginState;
    try {
      initial = await persistence.load();
    } catch (error) {
      console.error('Subvaults could not load:', error);
      new Notice(`Subvaults could not load its saved data: ${error instanceof Error ? error.message : 'An operation failed.'}`, 0);
      return;
    }
    this.app.workspace.onLayoutReady(() => {
      if (this.active) this.addChild(new PluginSession(this.app, initial, persistence));
    });
  }
  override onunload(): void { this.active = false; }
}
