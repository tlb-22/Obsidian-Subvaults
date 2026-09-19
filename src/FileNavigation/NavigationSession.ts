/** 拥有当前选择与每个视图的滚动恢复值，协调保存而不修改原生展开状态。 */
import type { Subvault, SubvaultId } from '../Subvaults/Subvault';
import { all, sameSelection, selectionKey, type NavigationState, type Selection } from './NavigationState';
export class NavigationSession {
  private current: NavigationState;
  private readonly listeners = new Set<() => void>();
  constructor(initial: NavigationState, private readonly save: (state: NavigationState) => Promise<void>, private readonly report: (error: unknown) => void) { this.current = initial; }
  get selection(): Selection { return this.current.selection; }
  get state(): NavigationState { return this.current; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  switchTo(selection: Selection): void {
    if (sameSelection(selection, this.selection)) return;
    this.current = { ...this.current, selection };
    for (const listener of this.listeners) listener();
    void this.flush().catch(this.report);
  }
  reconcile(subvaults: readonly Subvault[]): void {
    const ids = new Set<SubvaultId>(subvaults.map(s => s.id));
    const valid = (s: Selection) => s.kind === 'all' || ids.has(s.id);
    this.current = { ...this.current, positions: this.current.positions.filter(p => valid(p.selection)) };
    if (!valid(this.selection)) this.switchTo(all);
  }
  remember(selection: Selection, top: number): void {
    if (!Number.isFinite(top) || top < 0) throw new Error('Invalid scroll position');
    const key = selectionKey(selection);
    this.current = { ...this.current, positions: [...this.current.positions.filter(p => selectionKey(p.selection) !== key), { selection, top }] };
  }
  position(selection: Selection): number { return this.current.positions.find(p => sameSelection(p.selection, selection))?.top ?? 0; }
  flush(): Promise<void> { return this.save(this.current); }
}
