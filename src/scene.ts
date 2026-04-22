import { App, Notice } from 'obsidian';
import type LonerPlugin from '../main';
import { LonerModal } from './modals';
import { resolveOracle } from './oracle';
import { rollDie } from './oracle';

export type SceneType = 'dramatic' | 'quiet' | 'meanwhile';

export interface SceneRollResult {
  roll: number;
  type: SceneType;
  label: string;
}

export function rollSceneTransition(): SceneRollResult {
  const roll = rollDie(6);
  let type: SceneType;
  let label: string;

  if (roll <= 3) {
    type = 'dramatic';
    label = 'Dramatic Scene';
  } else if (roll <= 5) {
    type = 'quiet';
    label = 'Quiet Scene';
  } else {
    type = 'meanwhile';
    label = 'Meanwhile';
  }

  return { roll, type, label };
}

// ─── Meanwhile Modal ─────────────────────────────────────────────────────────

export class MeanwhileModal extends LonerModal {
  constructor(app: App, plugin: LonerPlugin, private sceneResult: SceneRollResult) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('loner-meanwhile-modal');
    contentEl.createEl('h2', { text: 'Meanwhile…' });
    contentEl.createEl('p', { text: `Roll: ${this.sceneResult.roll} — The world acts.`, cls: 'loner-scene-roll' });

    this.renderStep1(contentEl);
  }

  private renderStep1(container: HTMLElement): void {
    const step = container.createDiv({ cls: 'loner-meanwhile-step' });
    step.createEl('h3', { text: 'Step 1: Update the Opposition' });
    step.createEl('p', { text: 'Who holds power over the current situation? What do they do next?' });

    const oldTagRow = step.createDiv({ cls: 'loner-field-row' });
    oldTagRow.createEl('label', { text: 'Old tag:', cls: 'loner-field-label' });
    const oldTagInput = oldTagRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'e.g. In control' });

    const arrowEl = step.createEl('div', { cls: 'loner-meanwhile-arrow', text: '↓' });

    const newTagRow = step.createDiv({ cls: 'loner-field-row' });
    newTagRow.createEl('label', { text: 'New tag:', cls: 'loner-field-label' });
    const newTagInput = newTagRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'e.g. Mobilizing forces' });

    const openNpcBtn = step.createEl('button', { text: 'Open NPC Note', cls: 'loner-btn' });
    openNpcBtn.addEventListener('click', () => this.openNpcNote());

    const nextBtn = step.createEl('button', { text: 'Next →', cls: 'loner-btn loner-btn--primary' });
    nextBtn.addEventListener('click', () => this.renderStep2(container));
  }

  private renderStep2(container: HTMLElement): void {
    // Remove step 1
    container.querySelectorAll('.loner-meanwhile-step').forEach(el => el.remove());

    const step = container.createDiv({ cls: 'loner-meanwhile-step' });
    step.createEl('h3', { text: 'Step 2: Ask the Oracle' });
    step.createEl('p', { text: 'Does an ally or wildcard act independently?', cls: 'loner-meanwhile-question' });

    const rollBtn = step.createEl('button', { text: 'Roll Oracle', cls: 'loner-btn loner-btn--primary' });
    const resultArea = step.createDiv({ cls: 'loner-meanwhile-result' });

    rollBtn.addEventListener('click', () => {
      // Procedural roll — does NOT increment Twist Counter
      const chance = rollDie(6);
      const risk = rollDie(6);
      const result = resolveOracle(chance, risk);

      resultArea.empty();
      resultArea.createEl('p', { text: `Chance: ${chance} · Risk: ${risk} → ${result.label}`, cls: 'loner-oracle-dice-row' });

      const isYes = result.result === 'Yes';
      if (isYes) {
        const yesDiv = resultArea.createDiv({ cls: 'loner-meanwhile-yes' });
        yesDiv.createEl('p', { text: 'Who is the NPC most affected by recent events? What do they do? Update their tags.' });

        const npcRow = yesDiv.createDiv({ cls: 'loner-field-row' });
        npcRow.createEl('label', { text: 'NPC tag update:', cls: 'loner-field-label' });
        npcRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'New relationship tag…' });

        const openBtn = yesDiv.createEl('button', { text: 'Open NPC Note', cls: 'loner-btn' });
        openBtn.addEventListener('click', () => this.openNpcNote());
      } else {
        resultArea.createEl('p', { text: 'They hold. No independent action.', cls: 'loner-meanwhile-no' });
      }
    });

    // Insert into note
    const insertBtn = this.makeLonelogAwareInsertBtn(step, 'Insert into Note');
    insertBtn.addEventListener('click', async () => {
      let content: string;
      if (this.plugin.settings.useLonelog) {
        content = this.plugin.lonelogFormatter.formatSceneTransition(this.sceneResult.roll, this.sceneResult.label);
      } else {
        content = this.plugin.buildCallout(
          'scene',
          `${this.sceneResult.label} (${this.sceneResult.roll})`,
          ['Update opposition tags. Ask: Does an ally act independently?']
        );
      }
      await this.insertIntoActiveNote(content);
      this.close();
    });
  }

  private openNpcNote(): void {
    const files = this.app.vault.getMarkdownFiles().filter(f => {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      return fm?.loner_entity === true;
    });
    if (files.length === 0) {
      new Notice('No notes with loner_entity: true found in vault.');
      return;
    }
    // Open the first one; in a real implementation you'd show a fuzzy picker
    this.app.workspace.getLeaf(false).openFile(files[0]);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
