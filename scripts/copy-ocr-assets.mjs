// Copies the in-browser OCR engine (tesseract.js worker + wasm core + English + Hindi models, about 13 MB) from node_modules
// into public/tesseract so the image tab works without any third-party CDN. Runs before dev and build.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tesseract');
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
  ['node_modules/@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz', 'lang/hin.traineddata.gz'],
];
let missing = 0;
for (const [src, dest] of files) {
  const from = join(root, src);
  if (!existsSync(from)) {
    console.warn(`[ocr-assets] missing ${src}; the image tab will fall back to typed text`);
    missing++;
    continue;
  }
  mkdirSync(dirname(join(out, dest)), { recursive: true });
  cpSync(from, join(out, dest));
}
console.log(`[ocr-assets] copied ${files.length - missing}/${files.length} files to public/tesseract`);
