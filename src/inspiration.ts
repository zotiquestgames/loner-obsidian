import { App } from 'obsidian';
import type LonerPlugin from '../main';
import { LonerModal } from './modals';
import { rollDie } from './oracle';
import { lookupInspiration } from './tables';

export class InspirationModal extends LonerModal {
  private verbRow: number = 0;
  private verbCol: number = 0;
  private nounRow: number = 0;
  private nounCol: number = 0;
  private adjRow: number = 0;
  private adjCol: number = 0;
  private includeAdj: boolean = true;

  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('loner-inspiration-modal');
    contentEl.createEl('h2', { text: 'Inspiration Tables' });

    // ── Adjective toggle ──
    const adjToggleRow = contentEl.createDiv({ cls: 'loner-insp-adj-toggle' });
    const adjLabel = adjToggleRow.createEl('label');
    const adjCheckbox = adjLabel.createEl('input', { type: 'checkbox' });
    adjCheckbox.checked = true;
    adjLabel.appendText(' Include Adjective');
    adjCheckbox.addEventListener('change', () => {
      this.includeAdj = adjCheckbox.checked;
      adjSection.style.display = this.includeAdj ? 'block' : 'none';
      this.updateCombined(combined);
    });

    // ── Roll All button ──
    const rollAllBtn = contentEl.createEl('button', { text: 'Roll All', cls: 'loner-btn loner-btn--primary' });

    // ── Three sections ──
    const verbResult = this.makeTableSection(contentEl, 'Verb', () => {
      [this.verbRow, this.verbCol] = [rollDie(6), rollDie(6)];
      return lookupInspiration('verb', this.verbRow, this.verbCol);
    });

    const nounResult = this.makeTableSection(contentEl, 'Noun', () => {
      [this.nounRow, this.nounCol] = [rollDie(6), rollDie(6)];
      return lookupInspiration('noun', this.nounRow, this.nounCol);
    });

    const adjSection = contentEl.createDiv({ cls: 'loner-insp-section-wrapper' });
    const adjResult = this.makeTableSection(adjSection, 'Adjective', () => {
      [this.adjRow, this.adjCol] = [rollDie(6), rollDie(6)];
      return lookupInspiration('adjective', this.adjRow, this.adjCol);
    });

    // ── Combined display ──
    const combined = contentEl.createDiv({ cls: 'loner-insp-combined' });

    // ── Wire Roll All ──
    rollAllBtn.addEventListener('click', () => {
      verbResult.roll();
      nounResult.roll();
      if (this.includeAdj) adjResult.roll();
      this.updateCombined(combined);
    });

    // Patch roll callbacks to also update combined
    const origVerbRoll = verbResult.roll;
    verbResult.roll = () => { origVerbRoll(); this.updateCombined(combined); };
    const origNounRoll = nounResult.roll;
    nounResult.roll = () => { origNounRoll(); this.updateCombined(combined); };
    const origAdjRoll = adjResult.roll;
    adjResult.roll = () => { origAdjRoll(); this.updateCombined(combined); };

    // ── Insert ──
    const insertBtn = this.makeLonelogAwareInsertBtn(contentEl, 'Insert into Note');
    insertBtn.addEventListener('click', async () => {
      const verb = this.verbRow ? lookupInspiration('verb', this.verbRow, this.verbCol) : '';
      const noun = this.nounRow ? lookupInspiration('noun', this.nounRow, this.nounCol) : '';
      const adj = (this.includeAdj && this.adjRow) ? lookupInspiration('adjective', this.adjRow, this.adjCol) : undefined;

      if (!verb || !noun) return;

      let content: string;
      if (this.plugin.settings.useLonelog) {
        content = this.plugin.lonelogFormatter.formatInspiration(verb, noun, adj);
      } else {
        const parts = [verb, noun];
        if (adj) parts.push(adj);
        content = this.plugin.buildCallout('inspiration', parts.join(' · '), []);
      }
      await this.insertIntoActiveNote(content);
      this.close();
    });
  }

  private makeTableSection(
    container: HTMLElement,
    label: string,
    doRoll: () => string
  ): { roll: () => void } {
    const section = container.createDiv({ cls: 'loner-insp-section' });
    section.createEl('div', { text: label, cls: 'loner-insp-label' });

    const resultEl = section.createEl('span', { text: '—', cls: 'loner-insp-result' });

    const btnRow = section.createDiv({ cls: 'loner-insp-btn-row' });
    const rollBtn = btnRow.createEl('button', { text: 'Roll', cls: 'loner-btn' });
    const rerollBtn = btnRow.createEl('button', { text: 'Re-roll', cls: 'loner-btn' });

    const roll = (): void => {
      resultEl.setText(doRoll());
    };

    rollBtn.addEventListener('click', roll);
    rerollBtn.addEventListener('click', roll);

    return { roll };
  }

  private updateCombined(combined: HTMLElement): void {
    const parts: string[] = [];
    if (this.verbRow) parts.push(lookupInspiration('verb', this.verbRow, this.verbCol));
    if (this.nounRow) parts.push(lookupInspiration('noun', this.nounRow, this.nounCol));
    if (this.includeAdj && this.adjRow) parts.push(lookupInspiration('adjective', this.adjRow, this.adjCol));

    combined.empty();
    if (parts.length >= 2) {
      combined.createEl('div', { text: parts.join(' · '), cls: 'loner-insp-combined-text' });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
