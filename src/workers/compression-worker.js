import { optimise } from '@jsquash/oxipng';
import { compressPngPayload } from './compression-core.js';

let pngQuantizer = null;

async function getPngQuantizer() {
  if (pngQuantizer) return pngQuantizer;
  const mod = await import('https://esm.sh/@fe-daily/libimagequant-wasm@0.1.1');
  const LibImageQuant = mod.default;
  pngQuantizer = new LibImageQuant();
  return pngQuantizer;
}

self.onmessage = async (event) => {
  const { id, payload } = event.data;

  try {
    const output = await compressPngPayload(payload, {
      getPngQuantizer,
      optimise
    });
    const safeOutput = output.slice();
    self.postMessage({ id, ok: true, output: safeOutput });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Worker compression failed'
    });
  }
};
