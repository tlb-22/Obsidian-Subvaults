/** 适合作为 subvault 标识的固定图标清单；对应技术规格中的首批 49 项及其顺序。 */
import { iconId, type IconId } from '../Subvaults/Subvault';

export const subvaultIcons: readonly IconId[] = [
  'folder', 'box', 'archive', 'inbox', 'file-text',
  'briefcase', 'building-2', 'users', 'target', 'list-todo', 'flag',
  'book-open', 'graduation-cap', 'microscope', 'flask-conical',
  'notebook-pen', 'calendar', 'lightbulb', 'bookmark',
  'code', 'terminal', 'database',
  'pencil', 'palette', 'camera', 'music', 'film', 'gamepad-2',
  'house', 'heart', 'dumbbell', 'paw-print',
  'wallet', 'shopping-cart', 'receipt', 'utensils',
  'plane', 'compass', 'map-pin', 'leaf', 'sprout',
  'message-square',
  'lock', 'shield', 'key',
  'star', 'circle', 'triangle', 'hexagon',
].map(iconId);
