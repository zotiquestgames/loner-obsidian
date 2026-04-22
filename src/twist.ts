// 1-indexed arrays (index 0 unused)
export const TWIST_SUBJECTS = [
  '',
  'A third party',
  'The hero',
  'An encounter',
  'A physical event',
  'An emotional event',
  'An object',
];

export const TWIST_ACTIONS = [
  '',
  'Appears',
  'Alters the location',
  'Helps the hero',
  'Hinders the hero',
  'Changes the goal',
  'Ends the scene',
];

export function lookupTwist(subject: number, action: number): { subject: string; action: string } {
  return {
    subject: TWIST_SUBJECTS[subject] ?? TWIST_SUBJECTS[1],
    action: TWIST_ACTIONS[action] ?? TWIST_ACTIONS[1],
  };
}

export function getTwistIntensityNote(luck: number, statusBoxesFilled: number): string {
  if (luck <= 3 || statusBoxesFilled >= 2) {
    return 'High pressure — interpret at maximum disruption.';
  }
  return 'Clean state — interpret as a shift, not a collapse.';
}
