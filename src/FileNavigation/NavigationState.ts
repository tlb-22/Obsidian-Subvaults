/** 定义视图选择和恢复值，并从工作区文件事实推导外部文件集合。 */
import { containsPath, type FolderPath, type SubvaultId } from '../Subvaults/Subvault';
export type Selection = { readonly kind: 'all' } | { readonly kind: 'subvault'; readonly id: SubvaultId };
export interface ScrollPosition { readonly selection: Selection; readonly top: number }
export interface NavigationState { readonly selection: Selection; readonly positions: readonly ScrollPosition[] }
export const all: Selection = { kind: 'all' };
export function selectionKey(selection: Selection): string { return selection.kind === 'all' ? 'all' : selection.id; }
export function sameSelection(a: Selection, b: Selection): boolean { return selectionKey(a) === selectionKey(b); }
export function outsideFiles(root: FolderPath, openPaths: readonly string[]): readonly string[] {
  return [...new Set(openPaths)].filter(path => !containsPath(root, path)).sort((a, b) => a.localeCompare(b));
}
