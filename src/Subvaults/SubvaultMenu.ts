/** 通过原生右键菜单管理已存在的 subvault，外观选择复用创建流程的控件。 */
import { Menu, Notice } from 'obsidian';
import { AppearancePicker } from '../Presentation/AppearancePicker';
import { failureMessage } from './SubvaultFeedback';
import type { SubvaultCatalog } from './SubvaultCatalog';
import type { Appearance, Outcome, SubvaultFailure, SubvaultId } from './Subvault';
export class SubvaultMenu {
  private readonly picker = new AppearancePicker();
  private menu: Menu | null = null;
  constructor(private readonly catalog: SubvaultCatalog) {}
  private feedback(result: Outcome<void, SubvaultFailure>, success: string): void { new Notice(result.ok ? success : failureMessage(result.error), result.ok ? 2500 : 0); }
  open(event: MouseEvent, anchor: HTMLElement, id: SubvaultId): void {
    this.menu?.hide();
    const current = () => this.catalog.items.find(s => s.id === id);
    const change = (update: (appearance: Appearance) => Appearance) => { const s = current(); if (s) void this.catalog.changeAppearance(id, update(s)).then(r => this.feedback(r, 'Subvault updated.')); };
    const menu = new Menu(); this.menu = menu;
    menu.addItem(item => item.setTitle('Change icon…').setIcon('shapes').onClick(() => { const s = current(); if (s) this.picker.icon(anchor, s.icon, icon => change(a => ({ ...a, icon }))); }));
    menu.addItem(item => item.setTitle('Change color…').setIcon('palette').onClick(() => { const s = current(); if (s) this.picker.color(anchor, s.color, color => change(a => ({ ...a, color }))); }));
    menu.addSeparator();
    menu.addItem(item => item.setTitle('Remove subvault').setIcon('trash-2').onClick(() => { void this.catalog.remove(id).then(r => this.feedback(r, 'Subvault removed.')); }));
    menu.showAtMouseEvent(event);
  }
  dispose(): void { this.menu?.hide(); this.picker.close(); }
}
