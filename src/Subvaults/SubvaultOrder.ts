/** 以相邻 subvault 的身份表达插入位置，基于最新清单计算顺序。 */
import type { Outcome, Subvault, SubvaultFailure, SubvaultId } from './Subvault';

export interface SubvaultPosition { readonly anchor: SubvaultId; readonly side: 'before' | 'after' }

export function moveSubvault(current: readonly Subvault[], id: SubvaultId, position: SubvaultPosition): Outcome<readonly Subvault[], SubvaultFailure> {
  const source = current.find(s => s.id === id);
  if (!source || !current.some(s => s.id === position.anchor)) return { ok: false, error: { kind: 'subvault-removed' } };
  if (id === position.anchor) return { ok: true, value: current };
  const next = current.filter(s => s.id !== id);
  const index = next.findIndex(s => s.id === position.anchor) + (position.side === 'after' ? 1 : 0);
  next.splice(index, 0, source);
  return { ok: true, value: next.every((s, i) => s === current[i]) ? current : next };
}
