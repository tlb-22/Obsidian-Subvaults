/** 复用原生图标和延迟提示，提供实际共用的轻量控件及预设色呈现。 */
import { setIcon, setTooltip } from 'obsidian';
import type { IconColor } from '../Subvaults/Subvault';
export const colorValue: Readonly<Record<IconColor, string>> = {
  default: 'var(--text-muted)', red: 'var(--color-red)', orange: 'var(--color-orange)', yellow: 'var(--color-yellow)',
  lime: 'color-mix(in srgb, var(--color-yellow), var(--color-green))', green: 'var(--color-green)',
  teal: 'color-mix(in srgb, var(--color-green), var(--color-cyan))', cyan: 'var(--color-cyan)', blue: 'var(--color-blue)',
  purple: 'var(--color-purple)', pink: 'var(--color-pink)', brown: 'color-mix(in srgb, var(--color-orange) 65%, var(--text-muted))',
};
export function tooltip(el: HTMLElement, label: string): void {
  if (el.getAttribute('aria-label') !== label) setTooltip(el, label, { placement: 'top' });
}
/** 宿主的 pointerout 处理同时取消延迟任务与已显示提示，保留控件的无障碍名称。 */
export function dismissTooltip(el: HTMLElement): void { el.dispatchEvent(new Event('pointerout', { bubbles: true })); }
/** aria-label also creates an Obsidian tooltip; regions use a separate accessible label. */
export function labelRegion(el: HTMLElement, label: string, host = el): void {
  const text = host.createSpan({ cls: 'sv-visually-hidden', text: label });
  text.id = `sv-label-${crypto.randomUUID()}`;
  el.setAttribute('aria-labelledby', text.id);
}
export function iconButton(parent: HTMLElement, icon: string, label: string, action: (event: MouseEvent) => void): HTMLButtonElement {
  const button = parent.createEl('button', { cls: 'sv-button sv-icon-button', attr: { type: 'button' } });
  setIcon(button, icon); tooltip(button, label); button.addEventListener('click', action); return button;
}
