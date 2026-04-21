import { OXIPNG_MAX_LEVEL, PNGQUANT_MAX_COLORS } from './constants.js';

let oxipngEncode = null;
let pngQuantizer = null;

const OXIPNG_MODULE_URL_CANDIDATES = [
  '/oxipng-wasm/oxipng_wasm.js',
  'https://esm.sh/oxipng-wasm@0.1.0'
];

async function getOxipngEncode() {
  if (oxipngEncode) return oxipngEncode;

  let lastError = null;
  for (const moduleUrl of OXIPNG_MODULE_URL_CANDIDATES) {
    try {
      const mod = await import(moduleUrl);
      oxipngEncode = mod.encode;
      return oxipngEncode;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('oxipng moduleの読み込みに失敗しました');
}

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
  let quantizedBytes = new Uint8Array(await pngBlob.arrayBuffer());

  try {
    const quantizer = await getPngQuantizer();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quantizedResult = await quantizer.quantizeImageData(imageData, {
      maxColors: PNGQUANT_MAX_COLORS
    });
    quantizedBytes = quantizedResult.pngBytes;
  } catch (err) {
    console.warn(`pngquant(最大${PNGQUANT_MAX_COLORS}色)圧縮に失敗したため元PNGを利用します:`, err);
  }

  try {
    const encode = await getOxipngEncode();
    return encode(quantizedBytes, OXIPNG_MAX_LEVEL);
  } catch (err) {
    console.warn('oxipng圧縮に失敗したためpngquant結果を利用します:', err);
    return quantizedBytes;
  }
}

export function bytesToDataUrl(bytes, mime = 'image/png') {
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
