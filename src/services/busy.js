import { hideBusy, showBusy } from '../ui.js';

export async function withBusy(message, task) {
  showBusy(message);
  try {
    return await task();
  } finally {
    hideBusy();
  }
}
