import { logError } from './error-handler.js';

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export async function saveBlob(blob, suggestedName, mime, description, cancelLogMessage) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [mime]: [`.${suggestedName.split('.').pop()}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      logError(cancelLogMessage, err);
      return;
    }
  }

  downloadBlob(blob, suggestedName);
}
