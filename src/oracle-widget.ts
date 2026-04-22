import { MarkdownPostProcessorContext, Notice } from 'obsidian';
import type LonerPlugin from '../main';
import type { OracleResult } from '../main';
import { rollOracleWithMode } from './oracle';
import { InspirationModal } from './inspiration';

type OracleMode = 'neutral' | 'advantage' | 'disadvantage';

export function renderOracleWidget(
  el: HTMLElement,
  plugin: LonerPlugin,
  _ctx: MarkdownPostProcessorContext
): void {
  el.empty();
  const widget = el.createDiv({ cls: 'loner-oracle-widget' });

  // ── Question input (Lonelog mode only) ──
  let questionInput: HTMLInputElement | null = null;
  if (plugin.settings.useLonelog) {
    const qRow = widget.createDiv({ cls: 'loner-oracle-question-row' });
    qRow.createEl('label', { text: 'Question (optional)', cls: 'loner-oracle-label' });
    questionInput = qRow.createEl('input', { type: 'text', cls: 'loner-oracle-question-input' });
    (questionInput as HTMLInputElement).placeholder = 'Does Zahra make it inside unnoticed?';
  }

  // ── Mode buttons ──
  let currentMode: OracleMode = 'neutral';
  const modeRow = widget.createDiv({ cls: 'loner-oracle-mode-row' });

  const modes: { mode: OracleMode; label: string }[] = [
    { mode: 'disadvantage', label: 'Disadvantage' },
    { mode: 'neutral', label: 'Neutral' },
    { mode: 'advantage', label: 'Advantage' },
  ];

  const modeBtns: Map<OracleMode, HTMLButtonElement> = new Map();
  for (const { mode, label } of modes) {
    const btn = modeRow.createEl('button', { text: label, cls: 'loner-oracle-mode-btn' });
    if (mode === 'neutral') btn.addClass('loner-oracle-mode-btn--active');
    btn.addEventListener('click', () => {
      currentMode = mode;
      modeBtns.forEach((b, m) => {
        b.toggleClass('loner-oracle-mode-btn--active', m === mode);
      });
    });
    modeBtns.set(mode, btn);
  }

  // ── Conflict mode checkbox ──
  const conflictRow = widget.createDiv({ cls: 'loner-oracle-conflict-row' });
  const conflictLabel = conflictRow.createEl('label', { cls: 'loner-oracle-conflict-label' });
  const conflictCheckbox = conflictLabel.createEl('input', { type: 'checkbox' });
  conflictLabel.appendText(' Conflict (Harm & Luck)');

  // Opponent Luck section (shown when conflict mode active)
  const opponentSection = widget.createDiv({ cls: 'loner-oracle-opponent-section' });
  opponentSection.style.display = 'none';
  opponentSection.createEl('label', { text: 'Opponent Luck: ', cls: 'loner-oracle-label' });
  const opponentLuckInput = opponentSection.createEl('input', { type: 'number', cls: 'loner-oracle-opponent-luck' });
  (opponentLuckInput as HTMLInputElement).value = '6';
  (opponentLuckInput as HTMLInputElement).min = '0';
  (opponentLuckInput as HTMLInputElement).max = '20';
  const opponentLuckBar = opponentSection.createDiv({ cls: 'loner-oracle-opponent-bar' });

  conflictCheckbox.addEventListener('change', () => {
    plugin.conflictModeActive = conflictCheckbox.checked;
    opponentSection.style.display = conflictCheckbox.checked ? 'block' : 'none';
  });

  function updateOpponentBar(val: number): void {
    opponentLuckBar.empty();
    for (let i = 0; i < Math.max(val, 6); i++) {
      const pip = opponentLuckBar.createSpan({ cls: 'loner-luck-pip' });
      if (i < val) pip.addClass('loner-luck-pip--filled');
    }
  }
  updateOpponentBar(6);

  opponentLuckInput.addEventListener('input', () => {
    updateOpponentBar(parseInt((opponentLuckInput as HTMLInputElement).value) || 0);
  });

  // ── Roll button ──
  const rollBtn = widget.createEl('button', { text: 'Ask the Oracle', cls: 'loner-oracle-roll-btn' });

  // ── Result area ──
  const resultArea = widget.createDiv({ cls: 'loner-oracle-result' });
  resultArea.style.display = 'none';

  rollBtn.addEventListener('click', async () => {
    // Check if Leverage Advantage should override mode
    let effectiveMode = currentMode;
    if (plugin.leverageAdvantageActive) {
      if (currentMode === 'advantage') {
        new Notice('No effect — you already have Advantage. Leverage retained.');
        plugin.leverageAdvantageActive = false;
        // leverage stays in frontmatter — do NOT consume it
      } else {
        effectiveMode = 'advantage';
        plugin.leverageAdvantageActive = false;
        // Consume leverage from frontmatter now that it has actual effect
        plugin.protagonistSheet.setLeverage(null).then(async () => {
          if (plugin.settings.useLonelog) {
            try {
              const file = plugin.app.workspace.getActiveFile();
              if (file) await plugin.insertIntoActiveNote(plugin.lonelogFormatter.formatLeverage('', 'spent'));
            } catch { /* best effort */ }
          }
          plugin.refreshProtagonistView();
        }).catch(() => {});
      }
    }

    const roll = rollOracleWithMode(effectiveMode, plugin.settings.useStepDice);
    plugin.lastOracleResult = roll.result;

    // Increment Twist Counter only outside conflict mode
    let twistResult: { triggered: boolean; subject?: string; action?: string; intensityNote?: string } = { triggered: false };
    if (!plugin.conflictModeActive && roll.result.isDouble) {
      twistResult = await plugin.incrementTwistCounter();
    }

    renderResult(resultArea, roll, twistResult, plugin, conflictCheckbox.checked, opponentLuckInput as HTMLInputElement, opponentLuckBar, effectiveMode, questionInput);
    resultArea.style.display = 'block';
  });
}

function renderResult(
  resultArea: HTMLElement,
  roll: ReturnType<typeof rollOracleWithMode>,
  twistResult: { triggered: boolean; subject?: string; action?: string; intensityNote?: string },
  plugin: LonerPlugin,
  inConflict: boolean,
  opponentLuckInput: HTMLInputElement,
  opponentLuckBar: HTMLElement,
  mode: OracleMode,
  questionInput: HTMLInputElement | null
): void {
  resultArea.empty();

  const { chance, chanceSides, risk, riskSides, result } = roll;

  // Die values
  const diceRow = resultArea.createDiv({ cls: 'loner-oracle-dice-row' });
  if (plugin.settings.useStepDice && mode !== 'neutral') {
    diceRow.setText(`Chance (d${chanceSides}): ${chance}  ·  Risk (d${riskSides}): ${risk}`);
  } else {
    diceRow.setText(`Chance: ${chance}  ·  Risk: ${risk}`);
  }
  if (mode !== 'neutral') {
    const modeTag = diceRow.createSpan({ cls: 'loner-oracle-mode-tag' });
    modeTag.setText(` · ${mode === 'advantage' ? 'Advantage' : 'Disadvantage'}`);
  }

  // Result badge
  const badge = resultArea.createDiv({ cls: 'loner-oracle-result-badge' });
  badge.setText(result.label);
  badge.addClass(getResultClass(result));

  // Doubles / Twist notice
  if (result.isDouble) {
    const twistNotice = resultArea.createDiv({ cls: 'loner-oracle-twist-notice' });
    if (twistResult.triggered) {
      twistNotice.createSpan({ cls: 'loner-oracle-twist-icon', text: '⚡' });
      twistNotice.appendText(` Twist: ${twistResult.subject} / ${twistResult.action}`);
      resultArea.createDiv({ cls: 'loner-oracle-intensity-note', text: twistResult.intensityNote ?? '' });
    } else {
      twistNotice.setText('+1 Twist Counter');
    }
  }

  // Conflict / Harm & Luck
  if (inConflict) {
    const { target, amount } = result.luckDamage;
    const damageRow = resultArea.createDiv({ cls: 'loner-oracle-damage-row' });
    if (amount > 0) {
      damageRow.addClass(target === 'protagonist' ? 'loner-oracle-damage--take' : 'loner-oracle-damage--deal');
      damageRow.setText(target === 'protagonist' ? `Take ${amount}` : `Deal ${amount} to opponent`);
    }

    if (amount > 0) {
      const conflictBtns = resultArea.createDiv({ cls: 'loner-oracle-conflict-btns' });
      if (target === 'protagonist') {
        const applyMeBtn = conflictBtns.createEl('button', { text: 'Apply to Me', cls: 'loner-btn' });
        applyMeBtn.addEventListener('click', async () => {
          try {
            const current = await plugin.protagonistSheet.getLuck();
            const newLuck = Math.max(0, current - amount);
            await plugin.protagonistSheet.setLuck(newLuck);
            plugin.refreshProtagonistView();
            if (newLuck === 0) {
              new Notice('Conflict lost. Interpret consequences.', 8000);
            }
          } catch (e) {
            new Notice('Loner Assistant: ' + (e as Error).message);
          }
        });
      } else {
        const applyOppBtn = conflictBtns.createEl('button', { text: 'Apply to Opponent', cls: 'loner-btn' });
        applyOppBtn.addEventListener('click', () => {
          const current = parseInt(opponentLuckInput.value) || 0;
          const newVal = Math.max(0, current - amount);
          opponentLuckInput.value = String(newVal);
          updateOpponentBarInline(opponentLuckBar, newVal);
          if (newVal === 0) new Notice('Opponent Luck: 0 — Opponent is overcome!');
        });
      }
    }
  }

  // Inspiration link for but.../and... results
  if (result.modifier !== null && !result.isDouble) {
    const inspRow = resultArea.createDiv({ cls: 'loner-oracle-inspiration-row' });
    const inspBtn = inspRow.createEl('button', { text: 'Roll Inspiration', cls: 'loner-btn loner-btn--link' });
    inspBtn.addEventListener('click', () => {
      new InspirationModal(plugin.app, plugin).open();
    });
  }

  // Insert into note button
  const insertRow = resultArea.createDiv({ cls: 'loner-oracle-insert-row' });
  const insertBtn = insertRow.createEl('button', { text: 'Copy result to note', cls: 'loner-btn' });
  if (plugin.settings.useLonelog) {
    insertBtn.createSpan({ cls: 'loner-lonelog-badge', text: 'LL' });
  }
  insertBtn.addEventListener('click', async () => {
    try {
      let content: string;
      if (plugin.settings.useLonelog) {
        const question = questionInput?.value ?? '';
        content = plugin.lonelogFormatter.formatOracle(question, roll, result);
      } else {
        const lines: string[] = [`Chance: ${chance}  ·  Risk: ${risk}`];
        if (mode !== 'neutral') lines[0] += `  ·  ${mode === 'advantage' ? 'Advantage' : 'Disadvantage'}`;
        content = plugin.buildCallout(
          getCalloutType(result),
          result.label,
          lines
        );
      }
      await plugin.insertIntoActiveNote(content);
    } catch (e) {
      new Notice('Loner Assistant: ' + (e as Error).message);
    }
  });
}

function getResultClass(result: OracleResult): string {
  const classes: string[] = [];
  classes.push(result.result === 'Yes' ? 'loner-oracle-result--yes' : 'loner-oracle-result--no');
  if (result.modifier === 'and') classes.push('loner-oracle-result--and');
  if (result.modifier === 'but') classes.push('loner-oracle-result--but');
  if (result.isDouble) classes.push('loner-oracle-result--twist');
  return classes.join(' ');
}

function getCalloutType(result: OracleResult): string {
  if (result.isDouble) return 'oracle-twist';
  return result.result === 'Yes' ? 'oracle-yes' : 'oracle-no';
}

function updateOpponentBarInline(bar: HTMLElement, val: number): void {
  bar.empty();
  const max = Math.max(val, 6);
  for (let i = 0; i < max; i++) {
    const pip = bar.createSpan({ cls: 'loner-luck-pip' });
    if (i < val) pip.addClass('loner-luck-pip--filled');
  }
}
