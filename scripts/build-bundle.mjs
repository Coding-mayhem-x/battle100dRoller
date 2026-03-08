import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const algoPath = resolve('dist','algorithm.js');
const mainPath = resolve('dist','main.js');
const outPath  = resolve('dist','bundle.js');

let algo = readFileSync(algoPath, 'utf8');
let main = readFileSync(mainPath, 'utf8');

// Strip ESM exports/imports
algo = algo.replace(/^export\s+/gm, '');
main = main.replace(/^import\s+[^;]+;?\s*/m, '');

const out = `// Auto-generated bundle (no modules)\n` +
            `(function(){\n` + algo + `\n` + main + `\n})();\n`;
writeFileSync(outPath, out, 'utf8');
console.log('Built', outPath);
