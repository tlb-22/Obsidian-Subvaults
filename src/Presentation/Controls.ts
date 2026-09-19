/** 复用原生图标和延迟提示，提供实际共用的轻量控件及预设色呈现。 */
import { setIcon, setTooltip } from 'obsidian';
import type { IconColor } from '../Subvaults/Subvault';
export const colorValue: Readonly<Record<IconColor, string>> = {
  default: 'var(--text-muted)', red: 'var(--color-red)', orange: 'var(--color-orange)', yellow: 'var(--color-yellow)', lime: '#a3be4c', green: 'var(--color-green)',
  teal: '#3ba99c', cyan: 'var(--color-cyan)', blue: 'var(--color-blue)', purple: 'var(--color-purple)', pink: 'var(--color-pink)', brown: '#a67c52',
};
export function tooltip(el: HTMLElement, label: string): void {
  if (el.getAttribute('aria-label') !== label) setTooltip(el, label, { placement: 'top' });
}
/** aria-label also creates an Obsidian tooltip; regions use a separate accessible label. */
export function labelRegion(el: HTMLElement, label: string, host = el): void {
  const text = host.createSpan({ cls: 'sv-visually-hidden', text: label });
  text.id = `sv-label-${crypto.randomUUID()}`;
  el.setAttribute('aria-labelledby', text.id);
}
export function iconButton(parent: HTMLElement, icon: string, label: string, action: (event: MouseEvent) => void): HTMLButtonElement {
  const button = parent.createEl('button', { cls: 'clickable-icon sv-icon-button', attr: { type: 'button' } });
  setIcon(button, icon); tooltip(button, label); button.addEventListener('click', action); return button;
}
