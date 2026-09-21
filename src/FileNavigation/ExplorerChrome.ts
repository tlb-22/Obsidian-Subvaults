/** 持有稳定标题与切换条节点，按身份局部更新外观、选择及图标顺序。 */
import { setIcon } from 'obsidian';
import { folderName, type Subvault, type SubvaultId } from '../Subvaults/Subvault';
import { colorValue, iconButton, labelRegion, tooltip } from '../Presentation/Controls';
import { all, type Selection } from './NavigationState';
export class ExplorerChrome {
  private readonly header: HTMLElement;
  private readonly titleIcon: HTMLElement;
  private readonly titleName: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly allButton: HTMLButtonElement;
  private readonly buttons = new Map<SubvaultId, HTMLButtonElement>();
  constructor(host: HTMLElement, scroll: HTMLElement, switchTo: (selection: Selection) => void, create: () => void, menu: (event: MouseEvent, button: HTMLElement, id: SubvaultId) => void) {
    this.header = host.ownerDocument.createElement('div');
    this.header.className = 'sv-ui sv-header';
    this.titleIcon = this.header.createSpan('sv-header-icon');
    this.titleName = this.header.createSpan('sv-header-name');
    host.insertBefore(this.header, scroll);
    this.strip = host.createDiv({ cls: 'sv-ui sv-switcher', attr: { role: 'toolbar' } });
    labelRegion(this.strip, 'Subvaults');
    this.allButton = iconButton(this.strip, 'layers', 'All', () => switchTo(all));
    this.rail = this.strip.createDiv('sv-switcher-rail');
    iconButton(this.strip, 'plus', 'Create subvault', create);
    this.rail.addEventListener('wheel', event => { if (this.rail.scrollWidth > this.rail.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) { this.rail.scrollLeft += event.deltaY; event.preventDefault(); } }, { passive: false });
    this.makeButton = subvault => {
      const button = iconButton(this.rail, subvault.icon, subvault.root, () => switchTo({ kind: 'subvault', id: subvault.id }));
      button.dataset.subvaultId = subvault.id;
      button.addEventListener('contextmenu', event => { event.preventDefault(); menu(event, button, subvault.id); });
      return button;
    };
  }
  private readonly makeButton: (subvault: Subvault) => HTMLButtonElement;
  update(subvaults: readonly Subvault[], selection: Selection): void {
    const active = selection.kind === 'subvault' ? subvaults.find(s => s.id === selection.id) : undefined;
    if (selection.kind === 'subvault' && !active) throw new Error('Selected subvault must exist');
    const icon = active?.icon ?? 'layers', name = active ? folderName(active.root) : 'All';
    if (this.titleIcon.dataset.icon !== icon) { setIcon(this.titleIcon, icon); this.titleIcon.dataset.icon = icon; }
    this.titleIcon.style.color = colorValue[active?.color ?? 'default'];
    if (this.titleName.textContent !== name) this.titleName.textContent = name;
    this.allButton.setAttribute('aria-pressed', String(!active));
    const ids = new Set(subvaults.map(s => s.id));
    for (const [id, button] of this.buttons) if (!ids.has(id)) { button.remove(); this.buttons.delete(id); }
    let cursor = this.rail.firstElementChild;
    for (const s of subvaults) {
      let button = this.buttons.get(s.id);
      if (!button) { button = this.makeButton(s); this.buttons.set(s.id, button); }
      if (button.dataset.icon !== s.icon) { setIcon(button, s.icon); button.dataset.icon = s.icon; }
      button.style.color = colorValue[s.color];
      button.setAttribute('aria-pressed', String(active?.id === s.id));
      tooltip(button, s.root);
      if (cursor !== button) this.rail.insertBefore(button, cursor); else cursor = cursor.nextElementSibling;
    }
  }
  dispose(): void { this.header.remove(); this.strip.remove(); }
}
