/** Obsidian 插件入口：恢复配置、等待布局就绪并装配唯一业务会话。 */
import { Notice, Plugin } from 'obsidian';
import { decodeDocument, type PluginDocument } from './Persistence/PluginDocument';
import { PluginSession } from './App/PluginSession';

export default class SubvaultsPlugin extends Plugin {
  private active = false;
  override async onload(): Promise<void> {
    this.active = true;
    let initial: PluginDocument;
    try {
      initial = decodeDocument(await this.loadData());
    } catch (error) {
      console.error('Subvaults could not load:', error);
      new Notice('Subvaults could not read its data. Check data.json before reloading the plugin.', 0);
      return;
    }
    this.app.workspace.onLayoutReady(() => {
      if (this.active) this.addChild(new PluginSession(this.app, initial, data => this.saveData(data)));
    });
  }
  override onunload(): void { this.active = false; }
}
