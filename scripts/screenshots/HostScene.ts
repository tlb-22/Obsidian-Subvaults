/** 在截图实例中使用真实 Obsidian 与插件界面设置场景，并验明路径、语言及文件投影。 */
import type { App, FileSystemAdapter, TAbstractFile, View } from 'obsidian';
import { activeNote, expandedFolders, externalNote, researchId, type Scene } from './Scenarios';

interface FileItem { file: TAbstractFile; el: HTMLElement; setCollapsed(collapsed: boolean, animate: boolean): void }
interface Explorer extends View { fileItems: Record<string, FileItem>; getSortedFolderItems(folder: TAbstractFile): FileItem[]; sort(): void }
interface ScreenshotApp extends App {
  plugins: { enablePlugin(id: string): Promise<boolean>; plugins: Record<string, { manifest: { version: string } }> };
}
interface HostWindow extends Window { app: ScreenshotApp }
export interface SceneRequest { readonly vault: string; readonly pluginId: string; readonly version: string; readonly language: string; readonly newNote: string; readonly scene: Scene }
export interface Observation { readonly language: string; readonly nativeNewNote: string; readonly statusText: string; readonly hostVersion: string; readonly heading: string; readonly roots: readonly string[]; readonly externalFiles: readonly string[] }

export async function prepare(request: SceneRequest): Promise<Observation> {
  const app = (window as unknown as HostWindow).app;
  if ((app.vault.adapter as FileSystemAdapter).getBasePath() !== request.vault) throw new Error('Screenshot target is not the project screenshot vault');
  if (document.documentElement.lang !== request.language) throw new Error('Obsidian interface language does not match the screenshot');
  await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
  if (!app.plugins.plugins[request.pluginId]) await app.plugins.enablePlugin(request.pluginId);
  if (app.plugins.plugins[request.pluginId]?.manifest.version !== request.version) throw new Error('Screenshot plugin version differs from the build');
  const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
  if (!leaf) throw new Error('Screenshot file explorer is missing');
  const explorer = leaf.view as Explorer;
  const markdown = app.workspace.getLeavesOfType('markdown');
  const reading = markdown.find(item => item.getViewState().state?.file === externalNote);
  const research = markdown.find(item => item.getViewState().state?.file === activeNote);
  if (!reading || !research) throw new Error('Screenshot requires both research and reading tabs');
  app.workspace.setActiveLeaf(reading, { focus: false });
  app.workspace.setActiveLeaf(research, { focus: false });
  if (!explorer.containerEl.querySelector(`[aria-label="${request.newNote}"]`)) throw new Error('Native file explorer controls use the wrong language');
  const switcherDeadline = Date.now() + 3000;
  while (!explorer.containerEl.querySelector('.sv-switcher > button') && Date.now() < switcherDeadline) await new Promise(resolve => setTimeout(resolve, 50));
  const allButton = explorer.containerEl.querySelector<HTMLButtonElement>('.sv-switcher > button');
  if (!allButton) throw new Error('Subvault switcher is missing');
  allButton.click();
  for (const path of expandedFolders) explorer.fileItems[path]!.setCollapsed(false, false);
  explorer.sort();
  if (request.scene === 'subvault') explorer.containerEl.querySelector<HTMLButtonElement>(`[data-subvault-id="${researchId}"]`)!.click();
  if (app.workspace.getActiveFile()?.path !== activeNote) throw new Error('Screenshot editor is not showing the research note');
  await document.fonts.ready;
  const status = document.querySelector<HTMLElement>('.status-bar .plugin-word-count');
  const deadline = Date.now() + 3000;
  while (!status?.textContent?.trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  const statusText = status?.textContent?.trim();
  if (!statusText) throw new Error('Native word count did not initialize');
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const statusBounds = status!.getBoundingClientRect();
  if (!statusBounds.width || statusBounds.bottom > innerHeight || statusBounds.right > innerWidth) throw new Error('Native status bar is outside the screenshot');
  const heading = explorer.containerEl.querySelector('.sv-header-name')?.textContent ?? '';
  if (heading !== (request.scene === 'all' ? 'All' : 'Research')) throw new Error('Incorrect subvault heading');
  const externalFiles = Object.values(explorer.fileItems).filter(item => item.el.classList.contains('sv-external')).map(item => item.file.path);
  const expected = request.scene === 'all' ? [] : [externalNote];
  if (JSON.stringify(externalFiles) !== JSON.stringify(expected)) throw new Error('External open-file group does not match the scenario');
  if (request.scene === 'subvault' && !explorer.containerEl.querySelector('.sv-external-first')) throw new Error('External file divider is missing');
  const overlay = document.querySelector('.modal-container, .sv-create-panel, .sv-picker, .tooltip');
  if (overlay) throw new Error(`A transient overlay would cover the screenshot: ${overlay.className}: ${overlay.textContent?.slice(0, 400)}`);
  const hostVersion = /Obsidian ([\d.]+)$/.exec(document.title)?.[1];
  if (!hostVersion) throw new Error('Could not identify the Obsidian version');
  return { language: request.language, nativeNewNote: request.newNote, statusText, hostVersion, heading, roots: explorer.getSortedFolderItems(app.vault.getRoot()).map(item => item.file.path), externalFiles };
}
