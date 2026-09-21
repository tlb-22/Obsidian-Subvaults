/** 管理切换条内的原生拖放、插入提示及边缘滚动；落点提交交给业务层。 */
import { subvaultId, type SubvaultId } from '../Subvaults/Subvault';
import type { SubvaultPosition } from '../Subvaults/SubvaultOrder';
import { dismissTooltip } from '../Presentation/Controls';

interface DragSource { readonly id: SubvaultId; readonly button: HTMLButtonElement }
interface DropTarget { readonly button: HTMLButtonElement; readonly position: SubvaultPosition }

export class SwitcherDrag {
  private readonly win: Window;
  private readonly marker: HTMLElement;
  private source: DragSource | null = null;
  private pointerX: number | null = null;
  private frame: number | null = null;
  constructor(private readonly rail: HTMLElement, private readonly move: (id: SubvaultId, position: SubvaultPosition) => void) {
    this.win = rail.ownerDocument.defaultView!;
    this.marker = rail.ownerDocument.createElement('div');
    this.marker.className = 'sv-drop-marker';
    this.marker.hidden = true;
    this.marker.setAttribute('aria-hidden', 'true');
    rail.insertAdjacentElement('afterend', this.marker);
    rail.addEventListener('dragstart', this.start);
    rail.addEventListener('dragover', this.over);
    rail.addEventListener('dragleave', this.leave);
    rail.addEventListener('drop', this.drop);
    rail.addEventListener('dragend', this.end);
    rail.addEventListener('pointerover', this.suppressTooltip);
    rail.addEventListener('scroll', this.preview);
  }
  private readonly start = (event: DragEvent): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-subvault-id]');
    if (!button || !event.dataTransfer) return;
    this.end();
    this.source = { id: subvaultId(button.dataset.subvaultId!), button };
    dismissTooltip(button);
    event.dataTransfer.setData('application/x-obsidian-subvault', this.source.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(button, button.clientWidth / 2, button.clientHeight / 2);
    button.classList.add('sv-dragging');
    event.stopPropagation();
  };
  private readonly suppressTooltip = (event: PointerEvent): void => {
    if (this.source) event.stopPropagation();
  };
  private locate(x: number): DropTarget | null {
    const candidates = [...this.rail.querySelectorAll<HTMLButtonElement>('button[data-subvault-id]')];
    const before = candidates.find(button => { const r = button.getBoundingClientRect(); return x < r.left + r.width / 2; });
    const button = before ?? candidates.at(-1);
    return button ? { button, position: { anchor: subvaultId(button.dataset.subvaultId!), side: before ? 'before' : 'after' } } : null;
  }
  private readonly preview = (): void => {
    const target = this.pointerX === null ? null : this.locate(this.pointerX);
    this.marker.hidden = target === null;
    if (!target) return;
    const { button, position } = target, before = position.side === 'before';
    const rect = button.getBoundingClientRect();
    const neighbor = before ? button.previousElementSibling : button.nextElementSibling;
    const gap = parseFloat(this.win.getComputedStyle(this.rail).columnGap);
    const x = neighbor
      ? before ? (neighbor.getBoundingClientRect().right + rect.left) / 2 : (rect.right + neighbor.getBoundingClientRect().left) / 2
      : before ? rect.left - gap / 2 : rect.right + gap / 2;
    const strip = this.rail.parentElement!, origin = strip.getBoundingClientRect();
    const viewport = this.rail.getBoundingClientRect(), edge = parseFloat(this.win.getComputedStyle(strip).columnGap) / 2;
    const visibleX = Math.max(viewport.left - edge, Math.min(viewport.right + edge, x));
    this.marker.style.left = `${visibleX - origin.left - strip.clientLeft}px`;
    this.marker.style.top = `${rect.top + 3 - origin.top - strip.clientTop}px`;
    this.marker.style.height = `${rect.height - 6}px`;
  };
  private readonly over = (event: DragEvent): void => {
    if (!this.source) return;
    event.preventDefault(); event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.pointerX = event.clientX;
    this.preview();
    if (this.frame === null) this.frame = this.win.requestAnimationFrame(this.scroll);
  };
  private readonly scroll = (): void => {
    this.frame = null;
    if (this.pointerX === null) return;
    const rect = this.rail.getBoundingClientRect(), edge = Math.min(24, rect.width / 3);
    const speed = this.pointerX < rect.left + edge ? -8 : this.pointerX > rect.right - edge ? 8 : 0;
    const previous = this.rail.scrollLeft;
    this.rail.scrollLeft += speed;
    if (this.rail.scrollLeft !== previous) {
      this.preview();
      this.frame = this.win.requestAnimationFrame(this.scroll);
    }
  };
  private clearPreview(): void {
    this.pointerX = null;
    if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.preview();
  }
  private readonly leave = (event: DragEvent): void => {
    if (!this.source || (event.relatedTarget && this.rail.contains(event.relatedTarget as Node))) return;
    this.clearPreview();
  };
  private readonly drop = (event: DragEvent): void => {
    if (!this.source) return;
    event.preventDefault(); event.stopPropagation();
    const id = this.source.id, target = this.locate(event.clientX);
    this.end();
    if (target) this.move(id, target.position);
  };
  private readonly end = (): void => {
    this.source?.button.classList.remove('sv-dragging');
    this.source = null;
    this.clearPreview();
  };
  refresh(): void {
    if (this.source && !this.rail.contains(this.source.button)) this.end();
    else if (this.source) this.preview();
  }
  dispose(): void {
    this.end();
    this.rail.removeEventListener('dragstart', this.start);
    this.rail.removeEventListener('dragover', this.over);
    this.rail.removeEventListener('dragleave', this.leave);
    this.rail.removeEventListener('drop', this.drop);
    this.rail.removeEventListener('dragend', this.end);
    this.rail.removeEventListener('pointerover', this.suppressTooltip);
    this.rail.removeEventListener('scroll', this.preview);
    this.marker.remove();
  }
}
