import { OXIPNG_MAX_LEVEL, PNGQUANT_MAX_COLORS, PNGQUANT_SPEED } from './constants.js';

let compressionWorker = null;
let workerRequestSeq = 0;
const workerRequests = new Map();

function getCompressionWorker() {
  if (compressionWorker) return compressionWorker;

  compressionWorker = new Worker(new URL('./workers/compression-worker.js', import.meta.url), { type: 'module' });
  compressionWorker.addEventListener('message', (event) => {
    const { id, ok, output, error } = event.data;
    const pending = workerRequests.get(id);
    if (!pending) return;
    workerRequests.delete(id);

    if (ok) {
      pending.resolve(new Uint8Array(output));
    } else {
      pending.reject(new Error(error));
    }
  });

  compressionWorker.addEventListener('error', (error) => {
    for (const { reject } of workerRequests.values()) {
      reject(error);
    }
    workerRequests.clear();
  });

  return compressionWorker;
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

function postWorkerCompression(payload) {
  const worker = getCompressionWorker();
  const id = `cmp_${workerRequestSeq++}`;
  const request = new Promise((resolve, reject) => {
    workerRequests.set(id, { resolve, reject });
  });

  worker.postMessage({ id, payload }, [payload.pngBytes, payload.rgbaBytes]);
  return request;
}

export async function getCompressedPngBytes(canvas) {
  const pngBlob = await canvasToPngBlob(canvas);
  const [pngBuffer, imageData] = await Promise.all([
    pngBlob.arrayBuffer(),
    Promise.resolve(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height))
  ]);

  try {
    return await postWorkerCompression({
      pngBytes: pngBuffer,
      rgbaBytes: imageData.data.buffer,
      width: canvas.width,
      height: canvas.height,
      maxColors: PNGQUANT_MAX_COLORS,
      speed: PNGQUANT_SPEED,
      oxipngLevel: OXIPNG_MAX_LEVEL
    });
  } catch (error) {
    console.warn('Worker圧縮に失敗 → 元PNGを使用', error);
    return new Uint8Array(pngBuffer);
  }
}

export function bytesToDataUrl(bytes, mime = 'image/png') {
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
