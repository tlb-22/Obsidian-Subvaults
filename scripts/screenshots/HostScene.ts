/** 在截图实例中使用真实 Obsidian 与插件界面设置场景，并验明路径、语言及文件投影。 */
import type { App, FileSystemAdapter, TAbstractFile, View } from 'obsidian';
import { activeNote, expandedFolders, externalNote, newSubvault, researchId, type CaptureArea, type Scene } from './Scenarios';

interface FileItem { file: TAbstractFile; el: HTMLElement; setCollapsed(collapsed: boolean, animate: boolean): void }
interface Explorer extends View { fileItems: Record<string, FileItem>; getSortedFolderItems(folder: TAbstractFile): FileItem[]; sort(): void }
interface ScreenshotApp extends App {
  plugins: { enablePlugin(id: string): Promise<boolean>; plugins: Record<string, { manifest: { version: string } }> };
}
interface HostWindow extends Window { app: ScreenshotApp }
export interface SceneRequest { readonly vault: string; readonly pluginId: string; readonly version: string; readonly language: string; readonly newNote: string; readonly scene: Scene }
type SceneView =
  | { readonly kind: 'navigation'; readonly heading: string; readonly roots: readonly string[]; readonly externalFiles: readonly string[] }
  | { readonly kind: 'create'; readonly folder: string; readonly icon: string; readonly color: string };
export interface Observation { readonly language: string; readonly nativeNewNote: string; readonly hostVersion: string; readonly area: CaptureArea; readonly view: SceneView }

function control<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Screenshot control is missing: ${selector}`);
  return element;
}

function prepareCreation(container: HTMLElement): SceneView {
  control<HTMLButtonElement>(container, '.sv-switcher button[aria-label="Create subvault"]').click();
  const panel = control(container, '.sv-create-panel');
  const icon = control<HTMLButtonElement>(panel, 'button[aria-label="Icon"]');
  const color = control<HTMLButtonElement>(panel, 'button[aria-label="Color"]');
  icon.click();
  control<HTMLButtonElement>(document, `.sv-picker button[aria-label="${newSubvault.icon}"]`).click();
  color.click();
  control<HTMLButtonElement>(document, `.sv-color-grid button[aria-label="${newSubvault.color}"]`).click();
  color.click();
  const chosenColor = control<HTMLButtonElement>(document, '.sv-color-grid button[aria-pressed="true"]');
  const colorName = chosenColor.getAttribute('aria-label')!;
  chosenColor.click();
  control(panel, `.sv-folder-row[data-sv-folder="${newSubvault.folder}"]`).click();
  const folder = control(panel, '.sv-folder-row[aria-selected="true"]').dataset.svFolder!;
  const create = control<HTMLButtonElement>(panel, '.sv-create-footer .mod-cta');
  if (create.disabled || panel.querySelector('.sv-inline-error')?.textContent) throw new Error('Screenshot creation form is not ready to submit');
  (document.activeElement as HTMLElement).blur();
  return { kind: 'create', folder, icon: icon.dataset.icon!, color: colorName };
}

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
  let view: SceneView;
  if (request.scene === 'create') view = prepareCreation(explorer.containerEl);
  else {
    const heading = explorer.containerEl.querySelector('.sv-header-name')?.textContent ?? '';
    if (heading !== (request.scene === 'all' ? 'All' : 'Research')) throw new Error('Incorrect subvault heading');
    const externalFiles = Object.values(explorer.fileItems).filter(item => item.el.classList.contains('sv-external')).map(item => item.file.path);
    const expected = request.scene === 'all' ? [] : [externalNote];
    if (JSON.stringify(externalFiles) !== JSON.stringify(expected)) throw new Error('External open-file group does not match the scenario');
    if (request.scene === 'subvault' && !explorer.containerEl.querySelector('.sv-external-first')) throw new Error('External file divider is missing');
    view = { kind: 'navigation', heading, roots: explorer.getSortedFolderItems(app.vault.getRoot()).map(item => item.file.path), externalFiles };
  }
  await document.fonts.ready;
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const { x, y, width, height, right, bottom } = explorer.containerEl.getBoundingClientRect();
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || right > innerWidth || bottom > innerHeight) throw new Error('File explorer is outside the screenshot viewport');
  const overlay = document.querySelector(`.modal-container, .sv-picker, .tooltip${request.scene === 'create' ? '' : ', .sv-create-panel'}`);
  if (overlay) throw new Error(`A transient overlay would cover the screenshot: ${overlay.className}: ${overlay.textContent?.slice(0, 400)}`);
  const hostVersion = /Obsidian ([\d.]+)$/.exec(document.title)?.[1];
  if (!hostVersion) throw new Error('Could not identify the Obsidian version');
  return { language: request.language, nativeNewNote: request.newNote, hostVersion, area: { x, y, width, height }, view };
}
