/** 从文件夹路径和交互事实生成可见的单选树行，保留层级与搜索上下文。 */
import { folderName, type FolderPath } from './Subvault';
export interface FolderRow { readonly path: FolderPath; readonly name: string; readonly depth: number; readonly hasChildren: boolean }
export function visibleFolders(paths: readonly FolderPath[], expanded: ReadonlySet<FolderPath>, query: string): readonly FolderRow[] {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const parents = new Set(paths.filter(p => p.includes('/')).map(p => p.slice(0, p.lastIndexOf('/'))));
  const matches = terms.length ? new Set<string>() : null;
  if (matches) for (const path of sorted) {
    if (!terms.every(t => path.toLowerCase().includes(t))) continue;
    let current: string = path;
    while (current) { matches.add(current); const cut = current.lastIndexOf('/'); current = cut === -1 ? '' : current.slice(0, cut); }
  }
  return sorted.filter(path => {
    if (matches) return matches.has(path);
    let parent = path.slice(0, path.lastIndexOf('/'));
    if (!path.includes('/')) return true;
    while (parent) {
      if (!expanded.has(parent as FolderPath)) return false;
      const cut = parent.lastIndexOf('/');
      parent = cut === -1 ? '' : parent.slice(0, cut);
    }
    return true;
  }).map(path => ({ path, name: folderName(path), depth: path.split('/').length - 1, hasChildren: parents.has(path) }));
}
