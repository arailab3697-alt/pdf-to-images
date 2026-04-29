import { OXIPNG_MAX_LEVEL, PNGQUANT_MAX_COLORS } from './constants.js';
import { optimise } from '@jsquash/oxipng';

let pngQuantizer = null;

async function getPngQuantizer() {
  if (pngQuantizer) return pngQuantizer;

  const mod = await import('https://esm.sh/@fe-daily/libimagequant-wasm@0.1.1');
  const LibImageQuant = mod.default;

  pngQuantizer = new LibImageQuant();
  return pngQuantizer;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG Blobの生成に失敗しました'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export async function getCompressedPngBytes(canvas) {
  const pngBlob = await canvasToPngBlob(canvas);
  let bytes = new Uint8Array(await pngBlob.arrayBuffer());

  // --- pngquant（任意）
  try {
    const quantizer = await getPngQuantizer();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = await quantizer.quantizeImageData(imageData, {
      maxColors: PNGQUANT_MAX_COLORS
    });

    bytes = result.pngBytes;
  } catch (err) {
    console.warn(
      `pngquant(最大${PNGQUANT_MAX_COLORS}色)圧縮に失敗 → 元PNGを使用`,
      err
    );
  }

  // --- oxipng（jsquash）
  try {
    return await optimise(bytes, {
      level: OXIPNG_MAX_LEVEL
    });
  } catch (err) {
    console.warn('oxipng圧縮に失敗 → pngquant結果を使用', err);
    return bytes;
  }
}

export function bytesToDataUrl(bytes, mime = 'image/png') {
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
