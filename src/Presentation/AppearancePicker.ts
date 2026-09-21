/** 图标和预设色共用锚定弹层；网格只呈现图形，名称通过原生控件提示提供。 */
import { setIcon } from 'obsidian';
import { colors, type IconColor, type IconId } from '../Subvaults/Subvault';
import { colorValue, labelRegion, tooltip } from './Controls';
import { subvaultIcons } from './IconChoices';

export class AppearancePicker {
  private dismiss: (() => void) | null = null;
  close(): void { this.dismiss?.(); this.dismiss = null; }
  private open(anchor: HTMLElement, label: string): { panel: HTMLElement; reposition: () => void } {
    this.close();
    const doc = anchor.ownerDocument, win = doc.defaultView!;
    const panel = doc.body.createDiv({ cls: 'sv-ui sv-picker', attr: { role: 'dialog' } });
    labelRegion(panel, label);
    const reposition = () => {
      const rect = anchor.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
      const below = rect.bottom + 6;
      panel.style.left = `${Math.max(8, Math.min(rect.left, doc.documentElement.clientWidth - bounds.width - 8))}px`;
      panel.style.top = `${Math.max(8, below + bounds.height <= doc.documentElement.clientHeight - 8 ? below : rect.top - bounds.height - 6)}px`;
    };
    const outside = (event: PointerEvent) => { if (!panel.contains(event.target as Node) && !anchor.contains(event.target as Node)) this.close(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); anchor.focus(); }
    };
    const scroll = (event: Event) => { if (!panel.contains(event.target as Node)) this.close(); };
    const blur = () => this.close();
    doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', key, true);
    doc.addEventListener('scroll', scroll, true); win.addEventListener('resize', reposition); win.addEventListener('blur', blur);
    this.dismiss = () => {
      panel.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', key, true);
      doc.removeEventListener('scroll', scroll, true); win.removeEventListener('resize', reposition); win.removeEventListener('blur', blur);
    };
    return { panel, reposition };
  }
  private cell(grid: HTMLElement, label: string, selected: boolean, choose: () => void): HTMLButtonElement {
    const button = grid.createEl('button', { cls: 'sv-button sv-picker-cell', attr: { type: 'button', 'aria-pressed': String(selected) } });
    tooltip(button, label); button.addEventListener('click', choose);
    return button;
  }
  private keyboard(grid: HTMLElement): void {
    grid.addEventListener('keydown', event => {
      if (!(event.target instanceof grid.ownerDocument.defaultView!.HTMLButtonElement)) return;
      const buttons = Array.from(grid.querySelectorAll('button')), index = buttons.indexOf(event.target);
      const columns = grid.ownerDocument.defaultView!.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
      if (offset === undefined) return;
      event.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, index + offset))]?.focus();
    });
  }
  icon(anchor: HTMLElement, selected: IconId, choose: (icon: IconId) => void): void {
    const { panel, reposition } = this.open(anchor, 'Icon');
    const grid = panel.createDiv('sv-picker-grid'); this.keyboard(grid);
    for (const icon of subvaultIcons) {
      const button = this.cell(grid, icon, icon === selected.replace(/^lucide-/, ''), () => { this.close(); choose(icon); anchor.focus(); });
      setIcon(button, icon);
    }
    reposition(); grid.querySelector('button')!.focus();
  }
  color(anchor: HTMLElement, selected: IconColor, choose: (color: IconColor) => void): void {
    const { panel, reposition } = this.open(anchor, 'Color');
    const grid = panel.createDiv('sv-picker-grid sv-color-grid'); this.keyboard(grid);
    for (const color of colors) {
      const button = this.cell(grid, color[0]!.toUpperCase() + color.slice(1), color === selected, () => { this.close(); choose(color); anchor.focus(); });
      button.createSpan('sv-color-ring').style.color = colorValue[color];
    }
    reposition(); grid.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!.focus();
  }
}
