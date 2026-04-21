import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ACTION_DEPLOYED_OXIPNG_IMPORT = "'/oxipng-wasm/oxipng_wasm.js'";


test('compression module first tries action-deployed oxipng binary path', async () => {
  const compressionSource = await readFile(new URL('./js/compression.js', import.meta.url), 'utf8');
  assert.equal(compressionSource.includes(ACTION_DEPLOYED_OXIPNG_IMPORT), true);
});
