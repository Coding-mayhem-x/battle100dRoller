# Battle Loss Algorithm — Unified d100 Threshold Model

## Goal

This document describes a **single, unified battle resolution algorithm** intended for implementation in TypeScript.

The design goals are:

- the **same roll algorithm** is used for **all battles**
- the algorithm should work for both:
  - small battles like `1 vs 1`, `3 vs 2`, `4 vs 2`
  - larger battles like `20 vs 20`, `30 vs 3`
- the **attacker has a slight advantage**
- the attacker should still be able to **lose** in small and medium battles
- even in `4 vs 2`, the attacker should have a **small but real chance to lose**
- in large mismatches like `30 vs 3`, the attacker should **usually win**, but should still **take some losses**
- the algorithm should require only a **small number of dice rolls**
- the algorithm should be easy to verify manually using real dice
- the algorithm should be easy to tune later

The final chosen direction is a **unified `d100` threshold contest** model.

---

## Core Idea

Each side receives:

- a **threshold** on `d100`
- a **fixed number of d100 rolls**
- each roll that is `<= threshold` counts as **1 success**

Then:

- compare total successes
- the side with more successes wins
- if successes are equal, **attacker wins ties**
- the loser is reduced to `0 survivors`
- the winner keeps some survivors based on:
  - how decisive the victory was
  - how large the army ratio was

This keeps the battle logic identical across all scales.

---

## High-Level Rules

### 1. Use `d100` for every battle

All battles use the same die: `d100`.

That means the algorithm is always:

1. compute threshold
2. roll `d100` several times
3. count successes
4. compare successes
5. compute survivors

This avoids using different roll mechanics for small vs large battles.

---

### 2. Convert army size into threshold

Each side gets a threshold using this formula:

```ts
threshold = round(units * 2.5 + attackerBonus - crowdingPenalty)
```

Where:

- `units` is the number of units on that side
- `attackerBonus = 2` for attacker, `0` for defender
- `crowdingPenalty` applies only to the larger side

Then clamp the threshold into a safe range:

```ts
threshold = clamp(threshold, 1, 95)
```

Notes:

- threshold should never be `0`
- threshold should not exceed `95`, because `100%` success would be too rigid
- `2.5` is the starting scaling factor; it can be tuned later

---

### 3. Crowding penalty

A much larger army should lose some efficiency because of crowding / interference.

```ts
function crowdingPenalty(units: number, enemyUnits: number): number {
  if (units <= enemyUnits) return 0;
  const ratio = units / enemyUnits;
  return Math.floor((ratio - 1) * 3);
}
```

Interpretation:

- if armies are equal or smaller, there is no penalty
- if one side is much larger, its threshold is reduced
- this prevents `30 vs 3` from becoming absurdly one-sided

Example:

- `30 vs 3`
- attacker raw threshold: `30 * 2.5 + 2 = 77`
- ratio = `30 / 3 = 10`
- penalty = `floor((10 - 1) * 3) = 27`
- final threshold = `77 - 27 = 50`

So `30 vs 3` becomes strong, but not automatic.

---

### 4. Number of rolls

Use the same roll-count formula for every battle:

```ts
rollCount = max(2, ceil(sqrt(totalUnits) / 1.5))
```

Where:

- `totalUnits = attacker + defender`

Examples:

- `1 vs 1` -> total `2` -> `2` rolls per side
- `3 vs 2` -> total `5` -> `2` rolls per side
- `4 vs 2` -> total `6` -> `2` rolls per side
- `20 vs 20` -> total `40` -> `5` rolls per side
- `30 vs 3` -> total `33` -> `4` rolls per side

This keeps the roll count low while still allowing meaningful variance.

---

### 5. Success counting

Each side rolls `rollCount` times on `d100`.

Each roll that is `<= threshold` counts as **1 success**.

Example:

- threshold = `50`
- rolls = `11, 29, 62, 47`
- successes = `3`

---

### 6. Determine winner

Compare successes:

- if attacker successes > defender successes -> attacker wins
- if defender successes > attacker successes -> defender wins
- if equal -> attacker wins ties

This is the only built-in attacker advantage besides the small `+2 threshold` bonus.

---

### 7. Determine survivors

The loser always goes to `0 survivors`.

The winner keeps survivors based on:

- `successDiff`
- optional `ratioBonus`

#### 7.1 Success difference

```ts
successDiff = max(1, abs(attackerSuccesses - defenderSuccesses))
```

Treat ties resolved in favor of attacker as at least `1` margin for survivor calculation.

#### 7.2 Base survivor rate from success difference

```ts
function getBaseSurvivorRateFromDiff(diff: number): number {
  if (diff <= 1) return 0.20;
  if (diff === 2) return 0.35;
  if (diff === 3) return 0.50;
  if (diff === 4) return 0.65;
  return 0.80;
}
```

Interpretation:

- close win -> winner survives with few units
- clear win -> winner keeps more units

#### 7.3 Ratio bonus

If the winner was much larger than the loser, the winner should retain more survivors.

```ts
function getRatioBonus(winnerUnits: number, loserUnits: number): number {
  const ratio = winnerUnits / loserUnits;
  return Math.min(0.35, Math.max(0, (ratio - 1) * 0.04));
}
```

This helps:

- `30 vs 3` feel less absurdly bloody for the attacker
- `20 vs 20` remain brutal because ratio bonus is small or zero

#### 7.4 Final survivor rate

```ts
survivorRate = min(0.95, baseSurvivorRate + ratioBonus)
```

Then:

```ts
winnerSurvivors = max(1, round(winnerUnits * survivorRate))
loserSurvivors = 0
```

---

## Recommended TypeScript Implementation

```ts
export type BattleOutcome = {
  attackerThreshold: number;
  defenderThreshold: number;
  rollCount: number;
  attackerRolls: number[];
  defenderRolls: number[];
  attackerSuccesses: number;
  defenderSuccesses: number;
  winner: "attacker" | "defender";
  successDiff: number;
  survivorRate: number;
  attackerSurvivors: number;
  defenderSurvivors: number;
  attackerLosses: number;
  defenderLosses: number;
};

export function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

export function crowdingPenalty(units: number, enemyUnits: number): number {
  if (units <= enemyUnits) return 0;
  const ratio = units / enemyUnits;
  return Math.floor((ratio - 1) * 3);
}

export function getRollCount(attacker: number, defender: number): number {
  const total = attacker + defender;
  return Math.max(2, Math.ceil(Math.sqrt(total) / 1.5));
}

export function getThreshold(
  units: number,
  enemyUnits: number,
  isAttacker: boolean
): number {
  const raw = units * 2.5 + (isAttacker ? 2 : 0) - crowdingPenalty(units, enemyUnits);
  return Math.max(1, Math.min(95, Math.round(raw)));
}

export function getBaseSurvivorRateFromDiff(diff: number): number {
  if (diff <= 1) return 0.20;
  if (diff === 2) return 0.35;
  if (diff === 3) return 0.50;
  if (diff === 4) return 0.65;
  return 0.80;
}

export function getRatioBonus(winnerUnits: number, loserUnits: number): number {
  const ratio = winnerUnits / loserUnits;
  return Math.min(0.35, Math.max(0, (ratio - 1) * 0.04));
}

export function resolveBattle(attacker: number, defender: number): BattleOutcome {
  if (attacker <= 0 || defender <= 0) {
    throw new Error("Both sides must be greater than 0.");
  }

  const attackerThreshold = getThreshold(attacker, defender, true);
  const defenderThreshold = getThreshold(defender, attacker, false);
  const rollCount = getRollCount(attacker, defender);

  const attackerRolls = Array.from({ length: rollCount }, () => rollD100());
  const defenderRolls = Array.from({ length: rollCount }, () => rollD100());

  const attackerSuccesses = attackerRolls.filter(r => r <= attackerThreshold).length;
  const defenderSuccesses = defenderRolls.filter(r => r <= defenderThreshold).length;

  const winner: "attacker" | "defender" =
    attackerSuccesses >= defenderSuccesses ? "attacker" : "defender";

  const winnerUnits = winner === "attacker" ? attacker : defender;
  const loserUnits = winner === "attacker" ? defender : attacker;

  const successDiff = Math.max(1, Math.abs(attackerSuccesses - defenderSuccesses));
  const baseSurvivorRate = getBaseSurvivorRateFromDiff(successDiff);
  const ratioBonus = getRatioBonus(winnerUnits, loserUnits);
  const survivorRate = Math.min(0.95, baseSurvivorRate + ratioBonus);

  const winnerSurvivors = Math.max(1, Math.round(winnerUnits * survivorRate));

  const attackerSurvivors = winner === "attacker" ? winnerSurvivors : 0;
  const defenderSurvivors = winner === "defender" ? winnerSurvivors : 0;

  return {
    attackerThreshold,
    defenderThreshold,
    rollCount,
    attackerRolls,
    defenderRolls,
    attackerSuccesses,
    defenderSuccesses,
    winner,
    successDiff,
    survivorRate,
    attackerSurvivors,
    defenderSurvivors,
    attackerLosses: attacker - attackerSurvivors,
    defenderLosses: defender - defenderSurvivors,
  };
}
```

---

## Worked Examples

Below are tabletop-style examples using this exact algorithm.

### Example 1 — `1 vs 1`

#### Thresholds

- attacker: `round(1 * 2.5 + 2) = 5`
- defender: `round(1 * 2.5) = 3`

#### Roll count

- total = `2`
- `ceil(sqrt(2) / 1.5)` -> `1`
- minimum `2`
- final roll count = `2`

#### Example rolls

- attacker: `04, 88` -> `1 success`
- defender: `02, 77` -> `1 success`

Tie -> attacker wins.

#### Survivors

- diff = `1`
- base survivor rate = `0.20`
- ratio bonus = `0`
- attacker survivors = `round(1 * 0.20)` -> `1`

Final:

- attacker survives: `1`
- defender survives: `0`

---

### Example 2 — `3 vs 2`

#### Thresholds

- attacker: `round(3 * 2.5 + 2) = 10`
- defender: `round(2 * 2.5) = 5`

#### Roll count

- total = `5`
- final roll count = `2`

#### Example attacker win

- attacker rolls: `08, 61` -> `1 success`
- defender rolls: `44, 72` -> `0 successes`

#### Survivors

- diff = `1`
- base survivor rate = `0.20`
- ratio bonus = `(3/2 - 1) * 0.04 = 0.02`
- final survivor rate = `0.22`
- attacker survivors = `round(3 * 0.22)` -> `1`

Final:

- attacker survives: `1`
- defender survives: `0`

#### Example defender upset

- attacker rolls: `33, 84` -> `0 successes`
- defender rolls: `03, 91` -> `1 success`

#### Survivors

- diff = `1`
- defender base survivor rate = `0.20`
- defender ratio bonus = `0`
- defender survivors = `round(2 * 0.20)` -> `1`

Final:

- attacker survives: `0`
- defender survives: `1`

---

### Example 3 — `4 vs 2`

#### Thresholds

- attacker: `round(4 * 2.5 + 2) = 12`
- defender: `round(2 * 2.5) = 5`

#### Roll count

- total = `6`
- final roll count = `2`

#### Example defender upset

- attacker rolls: `40, 97` -> `0 successes`
- defender rolls: `04, 89` -> `1 success`

#### Survivors

- diff = `1`
- defender survivor rate = `0.20`
- defender survivors = `round(2 * 0.20)` -> `1`

Final:

- attacker survives: `0`
- defender survives: `1`

This should be rare, but possible.

---

### Example 4 — `20 vs 20`

#### Thresholds

- attacker: `round(20 * 2.5 + 2) = 52`
- defender: `round(20 * 2.5) = 50`

#### Roll count

- total = `40`
- `ceil(sqrt(40) / 1.5)` -> `5`
- final roll count = `5`

#### Example rolls

- attacker: `09, 18, 41, 67, 80` -> `3 successes`
- defender: `11, 44, 49, 77, 91` -> `3 successes`

Tie -> attacker wins.

#### Survivors

- diff = `1`
- base survivor rate = `0.20`
- ratio bonus = `0`
- attacker survivors = `round(20 * 0.20)` -> `4`

Final:

- attacker survives: `4`
- defender survives: `0`

This is intentionally a very bloody near-even battle.

---

### Example 5 — `30 vs 3`

#### Thresholds before crowding

- attacker raw threshold: `round(30 * 2.5 + 2) = 77`
- defender raw threshold: `round(3 * 2.5) = 8`

#### Crowding

- ratio = `30 / 3 = 10`
- attacker penalty = `floor((10 - 1) * 3) = 27`
- attacker final threshold = `77 - 27 = 50`
- defender threshold = `8`

#### Roll count

- total = `33`
- `ceil(sqrt(33) / 1.5)` -> `4`
- final roll count = `4`

#### Example rolls

- attacker: `11, 29, 62, 47` -> `3 successes`
- defender: `05, 42, 88, 97` -> `1 success`

#### Survivors

- diff = `2`
- base survivor rate = `0.35`
- ratio bonus = `min(0.35, (30/3 - 1) * 0.04)` -> `0.35`
- final survivor rate = `0.70`
- attacker survivors = `round(30 * 0.70)` -> `21`

Final:

- attacker survives: `21`
- defender survives: `0`

This produces the intended behavior:

- attacker clearly wins
- attacker still loses units
- the result is not absurdly bloodless

---

## Why This Version Was Chosen

This version is currently the best fit because it gives:

- one **unified roll algorithm** for every battle
- a single die type: `d100`
- low number of rolls
- a natural way to scale battle size through thresholds
- a natural way to tune probabilities later
- a real chance for small upsets like `3 vs 2` or even `4 vs 2`
- reasonable attacker losses in very uneven battles like `30 vs 3`

---

## Tuning Notes

If later testing shows the system needs adjustment, tune these parameters in this order:

### 1. Threshold scale

Current:

```ts
units * 2.5
```

Possible variants:

- `2.3` -> weaker army-size scaling
- `2.7` -> stronger army-size scaling
- `3.0` -> much stronger army-size scaling

---

### 2. Attacker bonus

Current:

```ts
+2
```

Possible variants:

- `+1` -> smaller attacker edge
- `+2` -> current baseline
- `+3` -> stronger attacker edge

---

### 3. Crowding penalty strength

Current:

```ts
floor((ratio - 1) * 3)
```

Possible variants:

- `* 2` -> softer crowding
- `* 3` -> current baseline
- `* 4` -> stronger crowding

---

### 4. Survivor table

Current:

- diff 1 -> 20%
- diff 2 -> 35%
- diff 3 -> 50%
- diff 4 -> 65%
- diff 5+ -> 80%

This table is intentionally brutal for close battles.

---

### 5. Ratio bonus cap

Current:

```ts
0.35
```

Possible variants:

- `0.25` -> large armies keep fewer survivors
- `0.35` -> current baseline
- `0.45` -> large mismatches become less bloody for the larger side

---

## Suggested Next Implementation Steps

1. implement the functions exactly as described above
2. add deterministic tests using mocked d100 rolls
3. run simulation batches for:
   - `1 vs 1`
   - `3 vs 2`
   - `4 vs 2`
   - `20 vs 20`
   - `30 vs 3`
4. observe:
   - win rates
   - average survivor counts
   - how often upsets occur
5. tune:
   - threshold scale
   - attacker bonus
   - crowding penalty
   - survivor table

---

## Suggested Test Cases for Implementation

At minimum, add tests that verify:

- `1 vs 1` can produce both attacker and defender wins depending on rolls
- `3 vs 2` allows defender upset on sufficiently lucky rolls
- `4 vs 2` allows rare defender upset on extreme rolls
- `20 vs 20` tends to produce low survivor counts in close results
- `30 vs 3` usually gives attacker victory with non-zero losses
- thresholds are clamped correctly
- roll count never drops below `2`
- crowding penalty only affects the larger side

---

End of specification.
