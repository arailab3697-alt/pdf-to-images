import { describe, expect, it, vi } from 'vitest';
import { compressPngPayload } from './compression-core.js';

class TestImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

globalThis.ImageData = TestImageData;

describe('worker compression core', () => {
  it('runs quantize -> optimise pipeline and returns optimized bytes', async () => {
    const quantizedBytes = new Uint8Array([9, 9, 9, 9]);
    const optimizedBytes = new Uint8Array([1, 2, 3, 4]);
    const quantizeImageData = vi.fn().mockResolvedValue({ pngBytes: quantizedBytes });
    const getPngQuantizer = vi.fn().mockResolvedValue({ quantizeImageData });
    const optimise = vi.fn().mockResolvedValue(optimizedBytes);

    const result = await compressPngPayload({
      pngBytes: new Uint8Array([137, 80, 78, 71]).buffer,
      rgbaBytes: new Uint8ClampedArray(4 * 4 * 4).buffer,
      width: 4,
      height: 4,
      maxColors: 64,
      speed: 4,
      oxipngLevel: 2
    }, { getPngQuantizer, optimise });

    expect(getPngQuantizer).toHaveBeenCalledTimes(1);
    expect(quantizeImageData).toHaveBeenCalledTimes(1);
    expect(optimise).toHaveBeenCalledWith(quantizedBytes, { level: 2 });
    expect(result).toEqual(optimizedBytes);
  });

  it('falls back to source PNG when quantize/optimise fail', async () => {
    const source = new Uint8Array([10, 20, 30, 40]);
    const getPngQuantizer = vi.fn().mockRejectedValue(new Error('quantize fail'));
    const optimise = vi.fn().mockRejectedValue(new Error('optimise fail'));

    const result = await compressPngPayload({
      pngBytes: source.buffer,
      rgbaBytes: new Uint8ClampedArray(4 * 4 * 4).buffer,
      width: 4,
      height: 4,
      maxColors: 64,
      speed: 4,
      oxipngLevel: 2
    }, { getPngQuantizer, optimise });

    expect(result).toEqual(source);
  });
});
