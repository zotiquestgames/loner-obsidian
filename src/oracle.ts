import type { OracleResult } from '../main';

// ─── Luck Damage Lookup ───────────────────────────────────────────────────────

const LUCK_TABLE: Record<string, OracleResult['luckDamage']> = {
  'Yes, and...': { target: 'opponent', amount: 3 },
  'Yes':         { target: 'opponent', amount: 2 },
  'Yes, but...': { target: 'opponent', amount: 1 },
  'No, but...':  { target: 'protagonist', amount: 1 },
  'No':          { target: 'protagonist', amount: 2 },
  'No, and...':  { target: 'protagonist', amount: 3 },
};

// ─── Core Functions ───────────────────────────────────────────────────────────

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function resolveOracle(chance: number, risk: number): OracleResult {
  const isDouble = chance === risk;

  // Doubles are ALWAYS Yes, but... — modifier check skipped entirely
  if (isDouble) {
    const label = 'Yes, but...';
    return {
      result: 'Yes',
      modifier: 'but',
      isDouble: true,
      label,
      luckDamage: LUCK_TABLE[label],
    };
  }

  const result: 'Yes' | 'No' = chance > risk ? 'Yes' : 'No';

  let modifier: 'and' | 'but' | null = null;
  if (chance <= 3 && risk <= 3) modifier = 'but';
  else if (chance >= 4 && risk >= 4) modifier = 'and';

  let label: string;
  if (modifier === null) {
    label = result;
  } else {
    label = `${result}, ${modifier}...`;
  }

  return {
    result,
    modifier,
    isDouble: false,
    label,
    luckDamage: LUCK_TABLE[label] ?? { target: 'protagonist', amount: 0 },
  };
}

export interface RollWithMode {
  chance: number;
  chanceSides: number;
  risk: number;
  riskSides: number;
  result: OracleResult;
}

export function rollOracleWithMode(
  mode: 'neutral' | 'advantage' | 'disadvantage',
  useStepDice: boolean
): RollWithMode {
  if (useStepDice) {
    return rollStepDice(mode);
  }
  return rollStandardDice(mode);
}

function rollStandardDice(mode: 'neutral' | 'advantage' | 'disadvantage'): RollWithMode {
  const chanceSides = 6;
  const riskSides = 6;
  let chance: number;
  let risk: number;

  if (mode === 'advantage') {
    chance = Math.max(rollDie(6), rollDie(6));
    risk = rollDie(6);
  } else if (mode === 'disadvantage') {
    chance = rollDie(6);
    risk = Math.max(rollDie(6), rollDie(6));
  } else {
    chance = rollDie(6);
    risk = rollDie(6);
  }

  return { chance, chanceSides, risk, riskSides, result: resolveOracle(chance, risk) };
}

function rollStepDice(mode: 'neutral' | 'advantage' | 'disadvantage'): RollWithMode {
  let chanceSides = 6;
  let riskSides = 6;

  if (mode === 'advantage') chanceSides = 8;
  else if (mode === 'disadvantage') riskSides = 8;
  // 2+ advantage/disadvantage (not reachable from normal UI but supported):
  // would be chanceSides=10 or riskSides=10

  const chance = rollDie(chanceSides);
  const risk = rollDie(riskSides);

  // Thresholds are UNCHANGED regardless of die size
  return { chance, chanceSides, risk, riskSides, result: resolveOracle(chance, risk) };
}
