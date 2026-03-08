import { computeBattle } from "../dist/algorithm.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const variants = [
  { a: 1, d: 1 },
  { a: 1, d: 3 },
  { a: 10, d: 12 },
  { a: 30, d: 5 },
  { a: 30, d: 30 },
];

function parseArgs() {
  const argv = process.argv.slice(2);
  let count = 20;
  let randomSeed = false;
  let seedPrefix = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count' || a === '-n') {
      const v = argv[++i];
      const parsed = parseInt(v ?? '20', 10);
      if (!Number.isNaN(parsed) && parsed > 0) count = parsed;
    } else if (a === '--random-seed') {
      randomSeed = true;
    } else if (a === '--seed-prefix') {
      seedPrefix = argv[++i] ?? '';
    }
  }
  if (randomSeed && !seedPrefix) {
    seedPrefix = `${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
  }
  return { count, randomSeed, seedPrefix };
}

function fmtRow({ idx, seed, out }) {
  const cells = [
    idx,
    seed,
    out.attacker.threshold,
    out.defender.threshold,
    out.rollCount,
    out.attacker.successes,
    out.defender.successes,
    out.winner,
    out.attacker.survivors,
    out.defender.survivors,
  ];
  return `| ${cells.join(" | ")} |`;
}

function runVariant(a, d, n, randomSeed, seedPrefix) {
  const rows = [];
  let attWins = 0, defWins = 0;
  let attSurvSum = 0, attSurvCount = 0;
  let defSurvSum = 0, defSurvCount = 0;

  for (let i = 1; i <= n; i++) {
    let seed;
    if (randomSeed) {
      seed = `${seedPrefix}_v_${a}x${d}_${i}_${randomBytes(4).toString('hex')}`;
    } else {
      seed = `v_${a}x${d}_${i.toString().padStart(2, "0")}`;
    }
    const out = computeBattle({ attacker: a, defender: d, seed });
    rows.push({ idx: i, seed, out });
    if (out.winner === "attacker") { attWins++; attSurvSum += out.attacker.survivors; attSurvCount++; }
    else { defWins++; defSurvSum += out.defender.survivors; defSurvCount++; }
  }

  const attSurvAvg = attSurvCount ? (attSurvSum / attSurvCount) : 0;
  const defSurvAvg = defSurvCount ? (defSurvSum / defSurvCount) : 0;

  return { rows, attWins, defWins, attSurvAvg, defSurvAvg };
}

function sectionMD(a, d, results) {
  const header = `### ${a} vs ${d}`;
  const tableHead = `| # | Seed | Att Thr | Def Thr | Rolls | Att S | Def S | Winner | Att Surv | Def Surv |\n| -: | :--- | -----: | -----: | ---: | ---: | ---: | :---: | ------: | ------: |`;
  const lines = results.rows.map(r => fmtRow(r));
  const summary = [
    "",
    `- Attacker wins: ${results.attWins} / ${results.rows.length}`,
    `- Defender wins: ${results.defWins} / ${results.rows.length}`,
    `- Avg attacker survivors on win: ${results.attSurvAvg.toFixed(2)}`,
    `- Avg defender survivors on win: ${results.defSurvAvg.toFixed(2)}`,
  ].join("\n");
  return [header, tableHead, ...lines, summary].join("\n");
}

function runAll() {
  const { count, randomSeed, seedPrefix } = parseArgs();
  const parts = [];
  const title = `# Battle Results (d100 threshold)\n\nGenerated: ${new Date().toISOString()}\n\nSettings: count=${count}, randomSeed=${randomSeed}${randomSeed ? `, seedPrefix=${seedPrefix}` : ''}`;
  parts.push(title);
  for (const v of variants) {
    const res = runVariant(v.a, v.d, count, randomSeed, seedPrefix);
    parts.push("");
    parts.push(sectionMD(v.a, v.d, res));
  }
  const outPath = resolve("reports", "results.md");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, parts.join("\n"), "utf8");
  console.log("Wrote", outPath);
}

runAll();
