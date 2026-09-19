/** 串行保存 data.json 的独立数据片段；仅在宿主写入成功后推进已提交快照。 */
import type { Subvault } from '../Subvaults/Subvault';
import type { NavigationState } from '../FileNavigation/NavigationState';
import type { PluginDocument } from './PluginDocument';
export class PluginPersistence {
  private pending: Promise<void> = Promise.resolve();
  constructor(private committed: PluginDocument, private readonly write: (data: PluginDocument) => Promise<void>) {}
  private update(change: (current: PluginDocument) => PluginDocument): Promise<void> {
    const next = this.pending.then(async () => { const data = change(this.committed); await this.write(data); this.committed = data; });
    this.pending = next.then(() => undefined, () => undefined);
    return next;
  }
  saveSubvaults(subvaults: readonly Subvault[]): Promise<void> { return this.update(doc => ({ ...doc, subvaults })); }
  saveNavigation(navigation: NavigationState): Promise<void> { return this.update(doc => ({ ...doc, navigation })); }
}
