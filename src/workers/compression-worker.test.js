import { beforeEach, describe, expect, it, vi } from 'vitest';

const compressPngPayload = vi.fn();

vi.mock('./compression-core.js', () => ({
  compressPngPayload
}));

describe('compression worker integration', () => {
  beforeEach(() => {
    vi.resetModules();
    compressPngPayload.mockReset();
  });

  it('wires self.onmessage and posts success response', async () => {
    const postMessage = vi.fn();
    globalThis.self = { postMessage, onmessage: null };

    await import('./compression-worker.js');

    const output = new Uint8Array([5, 6, 7, 8]);
    compressPngPayload.mockResolvedValue(output);

    const payload = { pngBytes: new Uint8Array([1]).buffer };
    await globalThis.self.onmessage({ data: { id: 'r1', payload } });

    expect(compressPngPayload).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      id: 'r1',
      ok: true,
      output
    });
  });

  it('posts error response when compression throws', async () => {
    const postMessage = vi.fn();
    globalThis.self = { postMessage, onmessage: null };

    await import('./compression-worker.js');

    compressPngPayload.mockRejectedValue(new Error('worker failure'));

    await globalThis.self.onmessage({ data: { id: 'r2', payload: {} } });

    expect(postMessage).toHaveBeenCalledWith({
      id: 'r2',
      ok: false,
      error: 'worker failure'
    });
  });
});
