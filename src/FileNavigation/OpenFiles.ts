/** 从宿主当前文件视图读取打开的文件，延迟视图通过宿主文件类型注册表判定。 */
import { FileView, type App } from 'obsidian';

/** Obsidian 内部注册表；文件扩展名到打开视图类型的映射由宿主和插件维护。 */
interface FileViewRegistry { getTypeByExtension(extension: string): string | undefined }

export function openFilePaths(app: App): readonly string[] {
  const { viewRegistry } = app as App & { readonly viewRegistry: FileViewRegistry };
  const paths: string[] = [];
  app.workspace.iterateAllLeaves(leaf => {
    if (leaf.view instanceof FileView && leaf.view.navigation) {
      const file = leaf.view.file;
      if (file && app.vault.getFileByPath(file.path)) paths.push(file.path);
      return;
    }
    if (!leaf.isDeferred) return;
    const { type, state } = leaf.getViewState();
    if (typeof state?.file !== 'string') return;
    const file = app.vault.getFileByPath(state.file);
    if (file && viewRegistry.getTypeByExtension(file.extension) === type) paths.push(file.path);
  });
  return paths;
}
