
import { computeBattle } from "../dist/algorithm.js";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sets = [
  { name: "4v2", pairs: [{a:4,d:2}] },
  { name: "5vX", pairs: [1,2,3,4,5].map(x => ({a:5,d:x})) },
  { name: "small-matrix", pairs: Array.from({length:4}, (_,i)=>i+1).flatMap(a => Array.from({length:4}, (_,j)=>({a, d:j+1}))) },
];

function run(a, d, count=2000) {
  let attWins=0, defWins=0, attSurv=0, defSurv=0;
  for (let i=0;i<count;i++) {
    const seed = `cal_${a}x${d}_${i}_${randomBytes(4).toString('hex')}`;
    const out = computeBattle({ attacker:a, defender:d, seed });
    if (out.winner==="attacker") { attWins++; attSurv += out.attacker.survivors; }
    else { defWins++; defSurv += out.defender.survivors; }
  }
  return {
    a,d,count,
    attRate: attWins/count,
    avgAttSurvOnWin: attWins? attSurv/attWins: 0,
    avgDefSurvOnWin: defWins? defSurv/defWins: 0,
  };
}

function fmt(r){ return `${r.a}v${r.d}: attRate=${(r.attRate*100).toFixed(1)}% | attSurvWin=${r.avgAttSurvOnWin.toFixed(2)} | defSurvWin=${r.avgDefSurvOnWin.toFixed(2)}` }

const lines=[];
for (const set of sets){
  lines.push(`# ${set.name}`);
  const results = [];
  for (const p of set.pairs){ results.push(run(p.a,p.d, 10000)); }
  for (const r of results){ lines.push(fmt(r)); }
  if (set.name==="5vX"){
    const rates = results.map(r=>r.attRate);
    const monotonic = rates.every((v,i,arr)=> i===0 || arr[i-1]>=v);
    lines.push(`monotonic(5v1..5v5): ${monotonic}`);
  }
  lines.push("");
}

const outPath = resolve("reports","calibration.md");
mkdirSync(dirname(outPath), { recursive:true });
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("Wrote", outPath);


