import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const OXIPNG_IMPORT = "import('https://esm.sh/oxipng-wasm@0.1.0')";

test('compression module imports oxipng from esm.sh', async () => {
  const compressionSource = await readFile(new URL('./js/compression.js', import.meta.url), 'utf8');
  assert.equal(compressionSource.includes(OXIPNG_IMPORT), true);
});
