import { randomBytes } from "node:crypto";

function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function rngFromSeed(seed){
  function strHash(str){ let h=1779033703 ^ str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h ^ str.charCodeAt(i), 3432918353); h=(h<<13)|(h>>>19);} return (h>>>0); }
  function mulberry32(a){ return function(){ let t=(a+=0x6D2B79F5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  return mulberry32(strHash(seed));
}

function rollD100(n,rng){ const a=[]; for(let i=0;i<n;i++) a.push((rng()*100|0)+1); return a; }
function countSucc(thr, rolls){ let s=0; for(const r of rolls) if (r<=thr) s++; return s; }
function prox(rolls, thr){ let best=-1e9, ok=false; for(const r of rolls){ if(r<=thr){ ok=true; best=Math.max(best, thr-r);} } if(!ok){ const m=Math.min(...rolls); best = thr-m; } return best; }

function simulate(a,d, params, trials=5000){
  const { SCALE, ATTACKER_BONUS, CROWD_FACTOR, TIE_BIAS, EDGE_BONUS=0 } = params;
  let attWins=0;
  for(let i=0;i<trials;i++){
    const seed=`s_${a}x${d}_${i}_${randomBytes(4).toString('hex')}`;
    const rng=rngFromSeed(seed);
    const total=a+d;
    const base = Math.ceil(Math.sqrt(total)/1.5);
    const rollCount = Math.max(2, base + (total<=6?1:0));
    const attPenalty = a<=d?0:Math.floor(((a/d)-1)*CROWD_FACTOR);
    const defPenalty = d<=a?0:Math.floor(((d/a)-1)*CROWD_FACTOR);
    const attThr = clamp(Math.round(a*SCALE + ATTACKER_BONUS + (a>d?EDGE_BONUS:0) - attPenalty),1,95);
    const defThr = clamp(Math.round(d*SCALE + 0 - defPenalty),1,95);
    const attRolls = rollD100(rollCount, rng);
    const defRolls = rollD100(rollCount, rng);
    const as = countSucc(attThr, attRolls);
    const ds = countSucc(defThr, defRolls);
    let winner;
    if (as>ds) winner='A'; else if (ds>as) winner='D'; else {
      const ap=prox(attRolls, attThr), dp=prox(defRolls, defThr);
      if (ap>dp) winner='A'; else if (dp>ap) winner='D'; else winner = (rng()<TIE_BIAS)?'A':'D';
    }
    if (winner==='A') attWins++;
  }
  return attWins/trials;
}

const grid = [];
for (const SCALE of [2.8,2.9,3.0]){
  for (const ATTACKER_BONUS of [5,6,7]){
    for (const CROWD_FACTOR of [0.3,0.4,0.6,0.8]){
      for (const TIE_BIAS of [0.55,0.6,0.65]){
        for (const EDGE_BONUS of [0,1,2]){ grid.push({SCALE, ATTACKER_BONUS, CROWD_FACTOR, TIE_BIAS, EDGE_BONUS}); }
      }
    }
  }
}

function score(params){
  const trials=800; // per point
  const r = [1,2,3,4,5].map(x=>simulate(5,x,params,trials));
  const mono = r.every((v,i,arr)=> i===0 || arr[i-1]>=v);
  const target = 0.80; // aim ~80% for 5v1
  const s = mono? -Math.abs(r[0]-target) - 0.4*Math.abs(r[1]-(target-0.07)) : -10;
  return { r, mono, fit:s };
}

let best=null;
for (const p of grid){
  const s = score(p);
  if (!best || s.fit>best.fit) best = {p, ...s};
}

console.log('Best params:', best.p);
console.log('Rates 5v1..5v5:', best.r.map(x=>(x*100).toFixed(1)+'%').join(', '), 'mono=',best.mono);






