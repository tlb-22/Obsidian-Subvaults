/** 串行协调配置变更与已发生的文件夹事件，独占当前 subvault 清单并发布结果。 */
import { createSubvault, followFolderChange, type Appearance, type FolderChange, type FolderPath, type Outcome, type Subvault, type SubvaultFailure, type SubvaultId } from './Subvault';

export interface CatalogStorage { saveSubvaults(value: readonly Subvault[]): Promise<void> }
export class SubvaultCatalog {
  private current: readonly Subvault[];
  private readonly listeners = new Set<() => void>();
  private pending: Promise<void> = Promise.resolve();
  constructor(initial: readonly Subvault[], private readonly storage: CatalogStorage, private readonly exists: (path: FolderPath) => boolean, private readonly nextId: () => SubvaultId) { this.current = initial; }
  get items(): readonly Subvault[] { return this.current; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private publish(next: readonly Subvault[]): void { this.current = next; for (const listener of this.listeners) listener(); }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }
  private async commit(next: readonly Subvault[]): Promise<Outcome<void, SubvaultFailure>> {
    try { await this.storage.saveSubvaults(next); }
    catch (cause) { return { ok: false, error: { kind: 'save-failed', cause } }; }
    this.publish(next);
    return { ok: true, value: undefined };
  }
  create(root: FolderPath, appearance: Appearance): Promise<Outcome<SubvaultId, SubvaultFailure>> {
    return this.enqueue(async () => {
      const candidate = { id: this.nextId(), root, ...appearance };
      const plan = createSubvault(this.current, candidate, this.exists(root));
      if (!plan.ok) return plan;
      const result = await this.commit(plan.value);
      return result.ok ? { ok: true, value: candidate.id } : result;
    });
  }
  changeAppearance(id: SubvaultId, appearance: Appearance): Promise<Outcome<void, SubvaultFailure>> {
    return this.enqueue(() => this.current.some(s => s.id === id)
      ? this.commit(this.current.map(s => s.id === id ? { ...s, ...appearance } : s))
      : Promise.resolve({ ok: false, error: { kind: 'subvault-removed' } }));
  }
  remove(id: SubvaultId): Promise<Outcome<void, SubvaultFailure>> {
    return this.enqueue(() => this.current.some(s => s.id === id)
      ? this.commit(this.current.filter(s => s.id !== id))
      : Promise.resolve({ ok: false, error: { kind: 'subvault-removed' } }));
  }
  observe(change: FolderChange): Promise<Outcome<void, SubvaultFailure>> {
    return this.enqueue(async () => {
      const next = followFolderChange(this.current, change);
      if (next.length === this.current.length && next.every((s, i) => s === this.current[i])) return { ok: true, value: undefined };
      this.publish(next);
      try { await this.storage.saveSubvaults(next); return { ok: true, value: undefined }; }
      catch (cause) { return { ok: false, error: { kind: 'save-failed', cause } }; }
    });
  }
}
