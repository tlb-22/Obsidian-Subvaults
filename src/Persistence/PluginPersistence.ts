/** 分别读写配置文件和本地导航状态，保持两条存储路径独立。 */
import type { Subvault } from '../Subvaults/Subvault';
import { emptyNavigation, type NavigationState } from '../FileNavigation/NavigationState';
import { decodeDocument, decodeNavigationDocument, type PluginDocument } from './PluginDocument';
export interface PluginStorage {
  loadData(): Promise<unknown>;
  saveData(document: PluginDocument): Promise<void>;
  loadNavigation(): unknown;
  saveNavigation(navigation: NavigationState): void;
}
export interface PluginState { readonly document: PluginDocument; readonly navigation: NavigationState }
export class PluginPersistence {
  constructor(private readonly storage: PluginStorage) {}
  async load(): Promise<PluginState> {
    const document = decodeDocument(await this.storage.loadData());
    const local = this.storage.loadNavigation();
    const navigation = local === null || local === undefined
      ? emptyNavigation
      : decodeNavigationDocument(local);
    return { document, navigation };
  }
  saveSubvaults(subvaults: readonly Subvault[]): Promise<void> { return this.storage.saveData({ subvaults }); }
  async saveNavigation(navigation: NavigationState): Promise<void> { this.storage.saveNavigation(navigation); }
}
