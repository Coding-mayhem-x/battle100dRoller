export function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}
export function crowdingPenalty(units, enemyUnits) {
    if (units <= enemyUnits)
        return 0;
    const ratio = units / Math.max(1, enemyUnits);
    const crowdFactor = 0.4; // softer than previous 3.0
    return Math.floor((ratio - 1) * crowdFactor);
}
export function computeRollCount(totalUnits) {
    const base = Math.ceil(Math.sqrt(Math.max(0, totalUnits)) / 1.5);
    const boost = totalUnits <= 6 ? 1 : 0; // more variance for tiny battles
    return Math.max(2, base + boost);
}
// Deterministic RNG (Mulberry32) from a string seed
function strHash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
}
function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function makeRng(seed) {
    if (!seed || !seed.trim())
        return Math.random;
    return mulberry32(strHash(seed));
}
export function rollD100(n, rng) {
    const rolls = [];
    for (let i = 0; i < n; i++) {
        const r = Math.floor(rng() * 100) + 1; // 1..100 inclusive
        rolls.push(r);
    }
    return rolls;
}
export function countSuccesses(threshold, rolls) {
    return rolls.reduce((acc, r) => acc + (r <= threshold ? 1 : 0), 0);
}
// Adjusted to reduce all-or-nothing in small battles
export function getBaseSurvivorRateFromDiff(diff) {
    if (diff <= 1)
        return 0.35;
    if (diff === 2)
        return 0.50;
    if (diff === 3)
        return 0.65;
    return 0.80;
}
export function getRatioBonus(winnerUnits, loserUnits) {
    if (winnerUnits <= loserUnits)
        return 0;
    const ratio = winnerUnits / Math.max(1, loserUnits);
    const bonus = (ratio - 1) * 0.04;
    return Math.min(0.35, Math.max(0, bonus));
}
function proximityScore(rolls, thr) {
    // Higher is better; successes => positive margin, all-fail => may be negative
    let best = -Infinity;
    let hasSuccess = false;
    for (const r of rolls) {
        if (r <= thr) {
            hasSuccess = true;
            best = Math.max(best, thr - r);
        }
    }
    if (!hasSuccess) {
        const minRoll = Math.min(...rolls);
        best = thr - minRoll; // closer to or below thr is better
    }
    return best;
}
function binomialKeep(units, rate, rng) {
    let keep = 0;
    for (let i = 0; i < units; i++)
        if (rng() < rate)
            keep++;
    return keep;
}
// Modified to guarantee at least 1 survivor for the winner, and at least 1 loss
// on close wins (diff <= 2) when the winner had more than 1 unit; adds binomial variation.
export function computeSurvivors(winnerUnits, loserUnits, successDiff, rng) {
    const base = getBaseSurvivorRateFromDiff(successDiff);
    const ratio = getRatioBonus(winnerUnits, loserUnits);
    // small random jitter +/-10% to avoid same-rounding plateaus
    const jitter = 0.9 + rng() * 0.2;
    const rate = Math.min(0.95, (base + ratio) * jitter);
    let survivors = binomialKeep(winnerUnits, rate, rng);
    const minLoss = winnerUnits > 1 && successDiff <= 2 ? 1 : 0;
    survivors = Math.max(1, Math.min(winnerUnits - minLoss, survivors));
    return survivors;
}
export function computeBattle(input) {
    const steps = [];
    const { attacker, defender, seed } = input;
    const total = attacker + defender;
    const rollCount = computeRollCount(total);
    const rng = makeRng(seed);
    steps.push(`Total units: ${total}`);
    steps.push(`Roll count = ${rollCount} (boosted for small totals)`);
    const attPenalty = crowdingPenalty(attacker, defender);
    const defPenalty = crowdingPenalty(defender, attacker);
    const attThreshold = clamp(Math.round(attacker * 2.9 + 6 + (attacker > defender ? 1 : 0) + (attacker === defender ? -2 : 0) - attPenalty), 1, 95);
    const defThreshold = clamp(Math.round(defender * 2.5 + 0 - defPenalty), 1, 95);
    steps.push(`Attacker crowding penalty = floor(((att=${attacker})/(def=${defender}) - 1)*3) = ${attPenalty}`);
    steps.push(`Attacker threshold = clamp(round(${attacker}*2.5 + 2 - ${attPenalty}),1,95) = ${attThreshold}`);
    steps.push(`Defender crowding penalty = floor(((def=${defender})/(att=${attacker}) - 1)*3) = ${defPenalty}`);
    steps.push(`Defender threshold = clamp(round(${defender}*2.5 + 0 - ${defPenalty}),1,95) = ${defThreshold}`);
    const attRolls = rollD100(rollCount, rng);
    const defRolls = rollD100(rollCount, rng);
    const attSucc = countSuccesses(attThreshold, attRolls);
    const defSucc = countSuccesses(defThreshold, defRolls);
    steps.push(`Attacker rolls: ${attRolls.join(', ')} => ${attSucc} successes (<= ${attThreshold})`);
    steps.push(`Defender rolls: ${defRolls.join(', ')} => ${defSucc} successes (<= ${defThreshold})`);
    let winner = null;
    if (attSucc > defSucc)
        winner = 'attacker';
    else if (defSucc > attSucc)
        winner = 'defender';
    else {
        const attScore = proximityScore(attRolls, attThreshold);
        const defScore = proximityScore(defRolls, defThreshold);
        if (attScore > defScore)
            winner = 'attacker';
        else if (defScore > attScore)
            winner = 'defender';
        else {
            // final coin with slight attacker edge (55/45)
            winner = rng() < 0.55 ? 'attacker' : 'defender';
            steps.push(`Tie-break exact: coin -> ${winner}`);
        }
        steps.push(`Tie-break proximity: att=${attScore.toFixed(2)} vs def=${defScore.toFixed(2)} => ${winner}`);
    }
    const successDiff = Math.max(1, Math.abs(attSucc - defSucc));
    let attSurv = 0, defSurv = 0;
    if (winner === 'attacker') {
        attSurv = computeSurvivors(attacker, defender, successDiff, rng);
        defSurv = 0; // loser routs
    }
    else {
        attSurv = 0;
        defSurv = computeSurvivors(defender, attacker, successDiff, rng);
    }
    steps.push(`Winner: ${winner} (diff = ${successDiff})`);
    if (winner === 'attacker') {
        steps.push(`Survivors(attacker) ~ binomial(${attacker}, rate ~ base(${getBaseSurvivorRateFromDiff(successDiff).toFixed(2)})+ratio(${getRatioBonus(attacker, defender).toFixed(2)})) => ${attSurv}`);
    }
    else {
        steps.push(`Survivors(defender) ~ binomial(${defender}, rate ~ base(${getBaseSurvivorRateFromDiff(successDiff).toFixed(2)})+ratio(${getRatioBonus(defender, attacker).toFixed(2)})) => ${defSurv}`);
    }
    return {
        rollCount,
        winner: winner,
        successDiff,
        steps,
        attacker: {
            side: 'attacker', units: attacker, threshold: attThreshold,
            rolls: attRolls, successes: attSucc, survivors: attSurv,
        },
        defender: {
            side: 'defender', units: defender, threshold: defThreshold,
            rolls: defRolls, successes: defSucc, survivors: defSurv,
        },
    };
}
