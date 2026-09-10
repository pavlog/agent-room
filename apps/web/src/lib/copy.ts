import { showToast } from '../components/Toast.js';

export async function copyText(text: string, successMsg: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
    return true;
  } catch {
    showToast('Could not copy. Select the text and copy it manually.');
    return false;
  }
}
