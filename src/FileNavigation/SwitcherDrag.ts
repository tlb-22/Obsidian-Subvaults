/** 管理切换条内的原生拖放、插入提示及边缘滚动；落点提交交给业务层。 */
import { subvaultId, type SubvaultId } from '../Subvaults/Subvault';
import type { SubvaultPosition } from '../Subvaults/SubvaultOrder';
import { dismissTooltip } from '../Presentation/Controls';

interface DragSource { readonly id: SubvaultId; readonly button: HTMLButtonElement }
interface DropTarget { readonly button: HTMLButtonElement; readonly position: SubvaultPosition }

export class SwitcherDrag {
  private readonly win: Window;
  private source: DragSource | null = null;
  private target: DropTarget | null = null;
  private pointerX: number | null = null;
  private frame: number | null = null;
  constructor(private readonly rail: HTMLElement, private readonly move: (id: SubvaultId, position: SubvaultPosition) => void) {
    this.win = rail.ownerDocument.defaultView!;
    rail.addEventListener('dragstart', this.start);
    rail.addEventListener('dragover', this.over);
    rail.addEventListener('dragleave', this.leave);
    rail.addEventListener('drop', this.drop);
    rail.addEventListener('dragend', this.end);
    rail.addEventListener('pointerover', this.suppressTooltip);
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
    const candidates = [...this.rail.querySelectorAll<HTMLButtonElement>('button[data-subvault-id]')].filter(button => button !== this.source?.button);
    const before = candidates.find(button => { const r = button.getBoundingClientRect(); return x < r.left + r.width / 2; });
    const button = before ?? candidates.at(-1);
    return button ? { button, position: { anchor: subvaultId(button.dataset.subvaultId!), side: before ? 'before' : 'after' } } : null;
  }
  private preview(): void {
    this.target?.button.removeAttribute('data-drop-side');
    this.target = this.pointerX === null ? null : this.locate(this.pointerX);
    if (this.target) this.target.button.dataset.dropSide = this.target.position.side;
  }
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
  }
}
