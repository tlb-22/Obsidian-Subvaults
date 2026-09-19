/** 将预期业务失败转换为英文反馈，保留底层错误供开发诊断。 */
import type { SubvaultFailure } from './Subvault';
export function failureMessage(failure: SubvaultFailure): string {
  switch (failure.kind) {
    case 'duplicate-folder': return 'This folder already has a subvault.';
    case 'folder-unavailable': return 'The selected folder is no longer available.';
    case 'subvault-removed': return 'This subvault has been removed.';
    case 'save-failed': return 'Could not save Subvaults data. Please try again.';
  }
}
