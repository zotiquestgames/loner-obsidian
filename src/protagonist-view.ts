import { ItemView, WorkspaceLeaf, Notice, Setting } from 'obsidian';
import type LonerPlugin from '../main';
import type { ProtagonistData, ChallengeTrack, StatusTrack } from '../main';
import { renderLeverageSection } from './leverage';
import { renderChallengeTrackSection } from './tracks';
import { renderStatusTrackSection } from './tracks';

export const VIEW_TYPE_PROTAGONIST = 'loner-protagonist-view';

export class ProtagonistView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: LonerPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_PROTAGONIST; }
  getDisplayText(): string { return 'Protagonist Sheet'; }
  getIcon(): string { return 'dice'; }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file.path === this.plugin.settings.protagonistNotePath) {
          this.refresh();
        }
      })
    );
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  async refresh(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('loner-protagonist-view');

    if (!this.plugin.settings.protagonistNotePath) {
      this.renderNoProtagonistGuard(contentEl);
      return;
    }

    let data: ProtagonistData;
    try {
      data = await this.plugin.protagonistSheet.read();
    } catch (e) {
      this.renderNoProtagonistGuard(contentEl, (e as Error).message);
      return;
    }

    this.renderIdentitySection(contentEl, data);
    this.renderSkillsGearSection(contentEl, data);
    this.renderLuckSection(contentEl, data);
    this.renderTagsSection(contentEl, data);
    this.renderRelationshipTagsSection(contentEl, data);
    this.renderTwistCounterSection(contentEl, data);

    if (this.plugin.settings.useLeverage) {
      renderLeverageSection(contentEl, this.plugin);
    }
    if (this.plugin.settings.useChallengeTracks) {
      renderChallengeTrackSection(contentEl, this.plugin);
    }
    if (this.plugin.settings.useStatusTrack) {
      renderStatusTrackSection(contentEl, this.plugin);
    }
  }

  // ─── Guard ──────────────────────────────────────────────────────────────────

  private renderNoProtagonistGuard(container: HTMLElement, msg?: string): void {
    const div = container.createDiv({ cls: 'loner-no-protagonist' });
    div.createEl('p', { text: msg ?? 'No Protagonist note set. Configure in Settings → Loner Assistant.' });
    const btn = div.createEl('button', { text: 'Open Settings', cls: 'loner-btn' });
    btn.addEventListener('click', () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById('loner-assistant');
    });
  }

  // ─── Section 1: Identity ────────────────────────────────────────────────────

  private renderIdentitySection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Identity');

    const fields: Array<{ key: keyof ProtagonistData; label: string }> = [
      { key: 'name', label: 'Name' },
      { key: 'concept', label: 'Concept' },
      { key: 'goal', label: 'Goal' },
      { key: 'motive', label: 'Motive' },
      { key: 'nemesis', label: 'Nemesis' },
    ];

    for (const { key, label } of fields) {
      const row = section.createDiv({ cls: 'loner-field-row' });
      row.createEl('label', { text: label, cls: 'loner-field-label' });
      const input = row.createEl('input', { type: 'text', cls: 'loner-field-input' });
      input.value = String(data[key] ?? '');
      input.addEventListener('blur', async () => {
        try {
          await this.plugin.protagonistSheet.write({ [key]: input.value });
        } catch (e) {
          new Notice('Loner Assistant: ' + (e as Error).message);
        }
      });
    }
  }

  // ─── Section 2: Skills & Gear ───────────────────────────────────────────────

  private renderSkillsGearSection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Skills & Gear');

    this.renderStringList(section, 'Skills', data.skill, async (arr) => {
      await this.plugin.protagonistSheet.write({ skill: arr });
    });

    this.renderStringList(section, 'Gear', data.gear, async (arr) => {
      await this.plugin.protagonistSheet.write({ gear: arr });
    });

    this.renderStringList(section, 'Frailties', data.frailty, async (arr) => {
      await this.plugin.protagonistSheet.write({ frailty: arr });
    });
  }

  private renderStringList(
    container: HTMLElement,
    label: string,
    items: string[],
    onUpdate: (arr: string[]) => Promise<void>
  ): void {
    const group = container.createDiv({ cls: 'loner-list-group' });
    group.createEl('div', { text: label, cls: 'loner-list-label' });
    const list = group.createDiv({ cls: 'loner-list' });

    const currentItems = [...items];

    const renderItems = (): void => {
      list.empty();
      currentItems.forEach((item, i) => {
        const row = list.createDiv({ cls: 'loner-list-row' });
        const input = row.createEl('input', { type: 'text', cls: 'loner-field-input' });
        input.value = item;
        input.addEventListener('blur', async () => {
          currentItems[i] = input.value;
          try { await onUpdate([...currentItems]); } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
        });
        const del = row.createEl('button', { text: '×', cls: 'loner-btn loner-btn--icon' });
        del.addEventListener('click', async () => {
          currentItems.splice(i, 1);
          renderItems();
          try { await onUpdate([...currentItems]); } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
        });
      });
    };

    renderItems();

    const addBtn = group.createEl('button', { text: '+', cls: 'loner-btn loner-btn--add' });
    addBtn.addEventListener('click', async () => {
      currentItems.push('');
      renderItems();
      try { await onUpdate([...currentItems]); } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
    });
  }

  // ─── Section 3: Luck ────────────────────────────────────────────────────────

  private renderLuckSection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Luck');

    const pipsRow = section.createDiv({ cls: 'loner-luck-pips' });
    const renderPips = (luck: number, luckMax: number): void => {
      pipsRow.empty();
      for (let i = 0; i < luckMax; i++) {
        const pip = pipsRow.createSpan({ cls: 'loner-luck-pip' });
        if (i < luck) pip.addClass('loner-luck-pip--filled');
        pip.title = `Set Luck to ${i + 1}`;
        pip.addEventListener('click', async () => {
          try {
            await this.plugin.protagonistSheet.setLuck(i + 1);
            renderPips(i + 1, luckMax);
          } catch (e) {
            new Notice('Loner Assistant: ' + (e as Error).message);
          }
        });
      }
    };
    renderPips(data.luck, data.luck_max);

    const controls = section.createDiv({ cls: 'loner-luck-controls' });

    const resetBtn = controls.createEl('button', { text: 'Reset Luck (end of conflict)', cls: 'loner-btn' });
    resetBtn.title = 'Luck is scoped to a single conflict and resets at its start and end.';
    resetBtn.addEventListener('click', async () => {
      try {
        await this.plugin.protagonistSheet.setLuck(data.luck_max);
        renderPips(data.luck_max, data.luck_max);
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    const maxRow = controls.createDiv({ cls: 'loner-luck-max-row' });
    maxRow.createEl('span', { text: `Max: ${data.luck_max}`, cls: 'loner-luck-max-label' });
    const minusBtn = maxRow.createEl('button', { text: '−', cls: 'loner-btn loner-btn--icon' });
    const plusBtn = maxRow.createEl('button', { text: '+', cls: 'loner-btn loner-btn--icon' });

    let currentMax = data.luck_max;
    minusBtn.addEventListener('click', async () => {
      if (currentMax <= 1) return;
      currentMax--;
      maxRow.querySelector('.loner-luck-max-label')!.textContent = `Max: ${currentMax}`;
      try {
        await this.plugin.protagonistSheet.write({ luck_max: currentMax });
        const newLuck = await this.plugin.protagonistSheet.getLuck();
        renderPips(Math.min(newLuck, currentMax), currentMax);
      } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
    });
    plusBtn.addEventListener('click', async () => {
      currentMax++;
      maxRow.querySelector('.loner-luck-max-label')!.textContent = `Max: ${currentMax}`;
      try {
        await this.plugin.protagonistSheet.write({ luck_max: currentMax });
        const newLuck = await this.plugin.protagonistSheet.getLuck();
        renderPips(newLuck, currentMax);
      } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
    });
  }

  // ─── Section 4: Tags ────────────────────────────────────────────────────────

  private renderTagsSection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Tags');
    this.renderTagList(section, data.tags, async (arr) => {
      await this.plugin.protagonistSheet.write({ tags: arr });
    });
  }

  // ─── Section 5: Relationship Tags ───────────────────────────────────────────

  private renderRelationshipTagsSection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Relationship Tags');
    this.renderTagList(section, data.relationship_tags, async (arr) => {
      await this.plugin.protagonistSheet.write({ relationship_tags: arr });
    });
  }

  private renderTagList(
    container: HTMLElement,
    tags: string[],
    onUpdate: (arr: string[]) => Promise<void>
  ): void {
    const currentTags = [...tags];
    const list = container.createDiv({ cls: 'loner-tag-list' });

    const renderTags = (): void => {
      list.empty();
      currentTags.forEach((tag, i) => {
        const row = list.createDiv({ cls: 'loner-tag-row' });
        const tagEl = row.createEl('span', { text: tag, cls: 'loner-tag' });

        // Visual Adv/Dis indicators (non-persisted)
        let tagState: 'none' | 'adv' | 'dis' = 'none';
        const advBtn = row.createEl('button', { text: '[Adv]', cls: 'loner-btn loner-btn--tag-adv' });
        const disBtn = row.createEl('button', { text: '[Dis]', cls: 'loner-btn loner-btn--tag-dis' });

        advBtn.addEventListener('click', () => {
          tagState = tagState === 'adv' ? 'none' : 'adv';
          advBtn.toggleClass('loner-btn--active', tagState === 'adv');
          disBtn.toggleClass('loner-btn--active', false);
        });
        disBtn.addEventListener('click', () => {
          tagState = tagState === 'dis' ? 'none' : 'dis';
          disBtn.toggleClass('loner-btn--active', tagState === 'dis');
          advBtn.toggleClass('loner-btn--active', false);
        });

        const del = row.createEl('button', { text: '×', cls: 'loner-btn loner-btn--icon' });
        del.addEventListener('click', async () => {
          currentTags.splice(i, 1);
          renderTags();
          try { await onUpdate([...currentTags]); } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
        });
      });
    };

    renderTags();

    const addRow = container.createDiv({ cls: 'loner-tag-add-row' });
    const addInput = addRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'New tag…' });
    const addBtn = addRow.createEl('button', { text: 'Add Tag', cls: 'loner-btn' });

    const doAdd = async (): Promise<void> => {
      const val = addInput.value.trim();
      if (!val) return;
      currentTags.push(val);
      addInput.value = '';
      renderTags();
      try { await onUpdate([...currentTags]); } catch (e) { new Notice('Loner Assistant: ' + (e as Error).message); }
    };

    addBtn.addEventListener('click', doAdd);
    addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
  }

  // ─── Section 6: Twist Counter ───────────────────────────────────────────────

  private renderTwistCounterSection(container: HTMLElement, data: ProtagonistData): void {
    const section = this.makeSection(container, 'Twist Counter');
    const n = data.twist_counter;

    if (n >= 2) section.addClass('loner-twist-warning');
    if (n >= 3) section.addClass('loner-twist-trigger');

    const pipsRow = section.createDiv({ cls: 'loner-twist-pips' });
    for (let i = 0; i < 3; i++) {
      const pip = pipsRow.createSpan({ cls: 'loner-twist-pip' });
      if (i < n) pip.addClass('loner-twist-pip--filled');
    }

    const controls = section.createDiv({ cls: 'loner-twist-controls' });

    const incBtn = controls.createEl('button', { text: '+1', cls: 'loner-btn' });
    incBtn.addEventListener('click', async () => {
      try {
        await this.plugin.incrementTwistCounter();
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    const resetBtn = controls.createEl('button', { text: 'Reset', cls: 'loner-btn' });
    resetBtn.addEventListener('click', async () => {
      try {
        await this.plugin.protagonistSheet.setTwistCounter(0);
        this.plugin.updateTwistStatusBar(0);
        this.plugin.refreshProtagonistView();
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    if (n >= 3) {
      const rollBtn = section.createEl('button', { text: 'Roll Twist', cls: 'loner-btn loner-btn--warning' });
      rollBtn.addEventListener('click', async () => {
        try {
          await this.plugin.incrementTwistCounter();
        } catch (e) {
          new Notice('Loner Assistant: ' + (e as Error).message);
        }
      });
    }
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  private makeSection(container: HTMLElement, title: string): HTMLElement {
    const details = container.createEl('details', { cls: 'loner-section' });
    details.setAttribute('open', '');
    details.createEl('summary', { text: title, cls: 'loner-section-title' });
    return details.createDiv({ cls: 'loner-section-content' });
  }
}
