import { optimise } from '@jsquash/oxipng';

let pngQuantizer = null;

async function getPngQuantizer() {
  if (pngQuantizer) return pngQuantizer;
  const mod = await import('https://esm.sh/@fe-daily/libimagequant-wasm@0.1.1');
  const LibImageQuant = mod.default;
  pngQuantizer = new LibImageQuant();
  return pngQuantizer;
}

async function compressInWorker({ pngBytes, rgbaBytes, width, height, maxColors, speed, oxipngLevel }) {
  let bytes = new Uint8Array(pngBytes);

  try {
    const quantizer = await getPngQuantizer();
    const imageData = new ImageData(new Uint8ClampedArray(rgbaBytes), width, height);
    const result = await quantizer.quantizeImageData(imageData, { maxColors, speed });
    bytes = result.pngBytes;
  } catch (error) {
    // Quantize failure is non-fatal. We fallback to source PNG.
  }

  try {
    return await optimise(bytes, { level: oxipngLevel });
  } catch (error) {
    return bytes;
  }
}

self.onmessage = async (event) => {
  const { id, payload } = event.data;

  try {
    const output = await compressInWorker(payload);
    self.postMessage({ id, ok: true, output }, [output.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Worker compression failed'
    });
  }
};
