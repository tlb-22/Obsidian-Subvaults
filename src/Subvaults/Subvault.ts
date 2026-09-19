/** 定义 subvault 的有效身份、绑定、外观及业务结果；只处理不可变值。 */
declare const idBrand: unique symbol;
declare const folderBrand: unique symbol;
declare const iconBrand: unique symbol;
export type SubvaultId = string & { readonly [idBrand]: true };
export type FolderPath = string & { readonly [folderBrand]: true };
export type IconId = string & { readonly [iconBrand]: true };
export const colors = ['default', 'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'purple', 'pink', 'brown'] as const;
export type IconColor = typeof colors[number];
export interface Appearance { readonly icon: IconId; readonly color: IconColor }
export interface Subvault extends Appearance { readonly id: SubvaultId; readonly root: FolderPath }
export type Outcome<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export type SubvaultFailure =
  | { readonly kind: 'folder-unavailable'; readonly path: string }
  | { readonly kind: 'duplicate-folder'; readonly path: string }
  | { readonly kind: 'subvault-removed' }
  | { readonly kind: 'save-failed'; readonly cause: unknown };

export function subvaultId(value: string): SubvaultId {
  if (!value || value === 'all') throw new Error('Invalid subvault identity');
  return value as SubvaultId;
}
export function folderPath(value: string): FolderPath {
  if (!value || value.startsWith('/') || value.endsWith('/') || value.includes('\\') || value.includes('\0') || value.split('/').some(p => p === '' || p === '.' || p === '..')) {
    throw new Error('Invalid vault-relative folder path');
  }
  return value as FolderPath;
}
export function iconId(value: string): IconId {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) throw new Error('Invalid icon identity');
  return value as IconId;
}
export function folderName(path: FolderPath): string { return path.slice(path.lastIndexOf('/') + 1); }
export function containsPath(root: string, path: string): boolean { return path === root || path.startsWith(`${root}/`); }
export function createSubvault(current: readonly Subvault[], candidate: Subvault, folderExists: boolean): Outcome<readonly Subvault[], SubvaultFailure> {
  if (!folderExists) return { ok: false, error: { kind: 'folder-unavailable', path: candidate.root } };
  if (current.some(s => s.root === candidate.root)) return { ok: false, error: { kind: 'duplicate-folder', path: candidate.root } };
  return { ok: true, value: [...current, candidate] };
}
export type FolderChange = { readonly kind: 'rename'; readonly oldPath: string; readonly path: string } | { readonly kind: 'delete'; readonly path: string };
export function followFolderChange(current: readonly Subvault[], change: FolderChange): readonly Subvault[] {
  if (change.kind === 'delete') return current.filter(s => !containsPath(change.path, s.root));
  return current.map(s => containsPath(change.oldPath, s.root)
    ? { ...s, root: folderPath(change.path + s.root.slice(change.oldPath.length)) } : s);
}
