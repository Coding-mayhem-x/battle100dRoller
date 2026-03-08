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
function simulate(a,d, p, trials=4000){
  let attWins=0; for(let i=0;i<trials;i++){ const seed=`q_${a}x${d}_${i}_${randomBytes(4).toString('hex')}`; const rng=rngFromSeed(seed);
    const total=a+d; const base=Math.ceil(Math.sqrt(total)/1.5); const rollCount=Math.max(2, base + (total<=6?1:0));
    const attPenalty = a<=d?0:Math.floor(((a/d)-1)*p.CROWD_FACTOR);
    const defPenalty = d<=a?0:Math.floor(((d/a)-1)*p.CROWD_FACTOR);
    const eqAdj = (a===d? (p.EQUAL_PENALTY||0) : 0);
    const attThr = clamp(Math.round(a*p.SCALE + p.ATTACKER_BONUS + (a>d?p.EDGE_BONUS:0) + eqAdj - attPenalty),1,95);
    const defThr = clamp(Math.round(d*p.SCALE + 0 - defPenalty),1,95);
    const attRolls = rollD100(rollCount, rng); const defRolls = rollD100(rollCount, rng);
    const as=countSucc(attThr, attRolls), ds=countSucc(defThr, defRolls);
    let winner; if(as>ds) winner='A'; else if (ds>as) winner='D'; else { const ap=prox(attRolls, attThr), dp=prox(defRolls, defThr); if(ap>dp) winner='A'; else if (dp>ap) winner='D'; else winner=(rng()<p.TIE_BIAS)?'A':'D'; }
    if (winner==='A') attWins++; }
  return attWins/trials;
}

const p = { SCALE:2.9, ATTACKER_BONUS:6, CROWD_FACTOR:0.4, TIE_BIAS:0.55, EDGE_BONUS:1, EQUAL_PENALTY:-2 };
const rates = [1,2,3,4,5].map(x=>simulate(5,x,p,5000));
console.log('Params',p,'Rates', rates.map(x=>(x*100).toFixed(1)+'%').join(', '));
