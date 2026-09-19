/** 验证持久化文档并恢复领域值；空白配置与格式错误具有不同语义。 */
import { colors, folderPath, iconId, subvaultId, type IconColor, type Subvault } from '../Subvaults/Subvault';
import { all, selectionKey, type NavigationState, type Selection } from '../FileNavigation/NavigationState';
export interface PluginDocument { readonly version: 1; readonly subvaults: readonly Subvault[]; readonly navigation: NavigationState }
export const emptyDocument: PluginDocument = { version: 1, subvaults: [], navigation: { selection: all, positions: [] } };
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object'); return value as Record<string, unknown>; }
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Expected a string'); return value; }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Expected an array'); return value; }
function selection(value: unknown): Selection {
  const s = object(value);
  if (s.kind === 'all') return all;
  if (s.kind === 'subvault') return { kind: 'subvault', id: subvaultId(string(s.id)) };
  throw new Error('Invalid view selection');
}
export function decodeDocument(raw: unknown): PluginDocument {
  if (raw === null || raw === undefined) return emptyDocument;
  const doc = object(raw);
  if (doc.version !== 1) throw new Error('Unsupported Subvaults data format');
  const subvaults = array(doc.subvaults).map(value => {
    const s = object(value), color = string(s.color);
    if (!colors.some(c => c === color)) throw new Error('Unknown icon color');
    return { id: subvaultId(string(s.id)), root: folderPath(string(s.root)), icon: iconId(string(s.icon)), color: color as IconColor };
  });
  if (new Set(subvaults.map(s => s.id)).size !== subvaults.length || new Set(subvaults.map(s => s.root)).size !== subvaults.length) throw new Error('Duplicate subvault identity or folder');
  const nav = object(doc.navigation);
  const positions = array(nav.positions).map(value => {
    const p = object(value);
    if (typeof p.top !== 'number' || !Number.isFinite(p.top) || p.top < 0) throw new Error('Invalid saved scroll position');
    return { selection: selection(p.selection), top: p.top };
  });
  if (new Set(positions.map(p => selectionKey(p.selection))).size !== positions.length) throw new Error('Duplicate scroll position');
  return { version: 1, subvaults, navigation: { selection: selection(nav.selection), positions } };
}
