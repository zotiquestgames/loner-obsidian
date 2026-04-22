import { App, Notice, TFile } from 'obsidian';
import type LonerPlugin from '../main';
import type { ProtagonistData } from '../main';
import { LonerModal } from './modals';

interface PendingChanges {
  protagonist: Partial<ProtagonistData>;
  npcUpdates: Map<string, Record<string, unknown>>;
  locationUpdates: Map<string, Record<string, unknown>>;
  unresolvedEvents: string;
}

export class LivingWorldModal extends LonerModal {
  private step = 1;
  private pending: PendingChanges = {
    protagonist: {},
    npcUpdates: new Map(),
    locationUpdates: new Map(),
    unresolvedEvents: '',
  };

  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    this.renderStep(1);
  }

  private renderStep(n: number): void {
    this.step = n;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('loner-living-world-modal');
    contentEl.createEl('h2', { text: `Living World — End of Session (${n}/5)` });

    switch (n) {
      case 1: this.renderStep1(contentEl); break;
      case 2: this.renderStep2(contentEl); break;
      case 3: this.renderStep3(contentEl); break;
      case 4: this.renderStep4(contentEl); break;
      case 5: this.renderStep5(contentEl); break;
    }
  }

  // ─── Step 1: Character Growth ─────────────────────────────────────────────

  private renderStep1(container: HTMLElement): void {
    container.createEl('h3', { text: 'Step 1: Character Growth' });
    container.createEl('p', { text: 'What did the Protagonist learn or gain?' });

    this.plugin.protagonistSheet.read().then(data => {
      // Add Skill
      this.makeAddField(container, 'Add Skill', async (val) => {
        const newSkills = [...(data.skills || []), val];
        this.pending.protagonist.skills = newSkills;
        await this.plugin.protagonistSheet.write({ skills: newSkills });
      });

      // Add Gear
      this.makeAddField(container, 'Add Gear', async (val) => {
        const newGear = [...(data.gear || []), val];
        this.pending.protagonist.gear = newGear;
        await this.plugin.protagonistSheet.write({ gear: newGear });
      });

      // Add Frailty (append or replace)
      this.makeAddField(container, 'Add Frailty', async (val) => {
        this.pending.protagonist.frailty = val;
        await this.plugin.protagonistSheet.write({ frailty: val });
      });

      // Modify existing trait
      const modSection = container.createDiv({ cls: 'loner-lw-mod-section' });
      modSection.createEl('div', { text: 'Modify Existing Trait', cls: 'loner-field-label' });
      const modRow = modSection.createDiv({ cls: 'loner-field-row' });
      const traitSelect = modRow.createEl('select', { cls: 'loner-field-select' });

      // Populate with current skills + gear
      const allTraits = [
        ...data.skills.map(s => `skill: ${s}`),
        ...data.gear.map(g => `gear: ${g}`),
      ];
      for (const t of allTraits) {
        traitSelect.createEl('option', { value: t, text: t });
      }

      const newValInput = modRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'New value…' });
      const modBtn = modRow.createEl('button', { text: 'Apply', cls: 'loner-btn' });
      modBtn.addEventListener('click', async () => {
        const [type, ...rest] = traitSelect.value.split(': ');
        const oldVal = rest.join(': ');
        const newVal = newValInput.value.trim();
        if (!newVal) return;
        if (type === 'skill') {
          const idx = data.skills.indexOf(oldVal);
          if (idx !== -1) { data.skills[idx] = newVal; await this.plugin.protagonistSheet.write({ skills: data.skills }); }
        } else if (type === 'gear') {
          const idx = data.gear.indexOf(oldVal);
          if (idx !== -1) { data.gear[idx] = newVal; await this.plugin.protagonistSheet.write({ gear: data.gear }); }
        }
        new Notice(`Updated "${oldVal}" → "${newVal}"`);
      });

      // New Nemesis
      this.makeAddField(container, 'New Nemesis', async (val) => {
        await this.plugin.protagonistSheet.write({ nemesis: val });
        new Notice(`Nemesis set to "${val}"`);
      });

      this.makeNavButtons(container, null, 2);
    }).catch(e => {
      container.createEl('p', { text: (e as Error).message, cls: 'loner-error' });
      this.makeNavButtons(container, null, 2);
    });
  }

  // ─── Step 2: NPC Updates ──────────────────────────────────────────────────

  private renderStep2(container: HTMLElement): void {
    container.createEl('h3', { text: 'Step 2: NPC Updates' });

    const npcs = this.getEntityNotes('npc');
    if (npcs.length === 0) {
      container.createEl('p', { text: 'No NPC notes found (need loner_entity: true and type: npc in frontmatter).' });
    }

    for (const file of npcs) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const block = container.createDiv({ cls: 'loner-lw-entity-block' });
      block.createEl('strong', { text: fm.name ?? file.basename });
      if (fm.concept) block.createEl('span', { text: ` — ${fm.concept}`, cls: 'loner-lw-concept' });

      const relTagRow = block.createDiv({ cls: 'loner-field-row' });
      relTagRow.createEl('label', { text: 'Relationship Tag:', cls: 'loner-field-label' });
      const relInput = relTagRow.createEl('input', { type: 'text', cls: 'loner-field-input' });
      relInput.value = fm.relationship_tag ?? '';
      relInput.addEventListener('blur', async () => {
        await this.app.fileManager.processFrontMatter(file, (fmOut) => {
          fmOut.relationship_tag = relInput.value;
        });
      });

      const goneRow = block.createDiv({ cls: 'loner-field-row' });
      const goneLabel = goneRow.createEl('label');
      const goneCheck = goneLabel.createEl('input', { type: 'checkbox' });
      goneCheck.checked = fm.inactive === true;
      goneLabel.appendText(' Mark as Gone/Inactive');
      goneCheck.addEventListener('change', async () => {
        await this.app.fileManager.processFrontMatter(file, (fmOut) => {
          fmOut.inactive = goneCheck.checked;
        });
      });

      const openBtn = block.createEl('button', { text: 'Open Note', cls: 'loner-btn' });
      openBtn.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(file));
    }

    this.makeNavButtons(container, 1, 3);
  }

  // ─── Step 3: Location Updates ─────────────────────────────────────────────

  private renderStep3(container: HTMLElement): void {
    container.createEl('h3', { text: 'Step 3: Location Updates' });

    const locations = this.getEntityNotes('location');
    if (locations.length === 0) {
      container.createEl('p', { text: 'No Location notes found (need loner_entity: true and type: location in frontmatter).' });
    }

    for (const file of locations) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const block = container.createDiv({ cls: 'loner-lw-entity-block' });
      block.createEl('strong', { text: fm.name ?? file.basename });

      const tagRow = block.createDiv({ cls: 'loner-field-row' });
      tagRow.createEl('span', { text: `Old tag: ${fm.current_tag ?? '—'}`, cls: 'loner-lw-old-tag' });
      tagRow.createEl('span', { text: ' → ', cls: 'loner-lw-arrow' });
      const newTagInput = tagRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'New tag…' });
      newTagInput.value = fm.current_tag ?? '';
      newTagInput.addEventListener('blur', async () => {
        await this.app.fileManager.processFrontMatter(file, (fmOut) => {
          fmOut.current_tag = newTagInput.value;
        });
      });

      const accessRow = block.createDiv({ cls: 'loner-field-row' });
      const accessLabel = accessRow.createEl('label');
      const accessCheck = accessLabel.createEl('input', { type: 'checkbox' });
      accessCheck.checked = fm.accessible !== false;
      accessLabel.appendText(' Accessible');
      accessCheck.addEventListener('change', async () => {
        await this.app.fileManager.processFrontMatter(file, (fmOut) => {
          fmOut.accessible = accessCheck.checked;
        });
      });

      const openBtn = block.createEl('button', { text: 'Open Note', cls: 'loner-btn' });
      openBtn.addEventListener('click', () => this.app.workspace.getLeaf(false).openFile(file));
    }

    this.makeNavButtons(container, 2, 4);
  }

  // ─── Step 4: Unresolved Events ────────────────────────────────────────────

  private renderStep4(container: HTMLElement): void {
    container.createEl('h3', { text: 'Step 4: Unresolved Events' });
    container.createEl('p', { text: 'Note unresolved threads and the pressure they continue to exert.' });

    const textarea = container.createEl('textarea', { cls: 'loner-lw-textarea' });
    textarea.rows = 6;
    textarea.value = this.pending.unresolvedEvents;
    textarea.addEventListener('input', () => {
      this.pending.unresolvedEvents = textarea.value;
    });

    const addNoteBtn = container.createEl('button', { text: 'Add Event Note', cls: 'loner-btn' });
    addNoteBtn.addEventListener('click', async () => {
      const path = `Events/Event-${Date.now()}.md`;
      const template = `---\nloner_entity: true\ntype: event\n---\n\n# Unresolved Event\n\n${textarea.value}\n`;
      try {
        const file = await this.app.vault.create(path, template);
        new Notice(`Event note created: ${path}`);
        this.app.workspace.getLeaf(false).openFile(file);
      } catch (e) {
        new Notice('Loner 4e: ' + (e as Error).message);
      }
    });

    this.makeNavButtons(container, 3, 5);
  }

  // ─── Step 5: Summary ─────────────────────────────────────────────────────

  private renderStep5(container: HTMLElement): void {
    container.createEl('h3', { text: 'Step 5: Session Summary' });
    container.createEl('p', { text: 'Review all changes made this session.' });

    const summary = container.createDiv({ cls: 'loner-lw-summary' });

    if (Object.keys(this.pending.protagonist).length > 0) {
      summary.createEl('div', { text: 'Protagonist changes:', cls: 'loner-lw-summary-header' });
      for (const [k, v] of Object.entries(this.pending.protagonist)) {
        summary.createEl('div', { text: `  ${k}: ${JSON.stringify(v)}`, cls: 'loner-lw-summary-line' });
      }
    }

    if (this.pending.unresolvedEvents) {
      summary.createEl('div', { text: 'Unresolved events noted.', cls: 'loner-lw-summary-line' });
    }

    if (summary.children.length === 0) {
      summary.createEl('p', { text: 'No tracked changes this session.' });
    }

    const finishBtn = container.createEl('button', { text: 'Finish', cls: 'loner-btn loner-btn--primary' });
    finishBtn.addEventListener('click', () => {
      new Notice('Session end recorded. Good game!');
      this.close();
    });

    const backBtn = container.createEl('button', { text: '← Back', cls: 'loner-btn' });
    backBtn.addEventListener('click', () => this.renderStep(4));
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private makeAddField(
    container: HTMLElement,
    label: string,
    onAdd: (val: string) => Promise<void>
  ): void {
    const row = container.createDiv({ cls: 'loner-field-row' });
    row.createEl('label', { text: label + ':', cls: 'loner-field-label' });
    const input = row.createEl('input', { type: 'text', cls: 'loner-field-input' });
    const btn = row.createEl('button', { text: 'Add', cls: 'loner-btn' });
    const doAdd = async (): Promise<void> => {
      const val = input.value.trim();
      if (!val) return;
      try {
        await onAdd(val);
        input.value = '';
        new Notice(`${label}: "${val}" added.`);
      } catch (e) {
        new Notice('Loner 4e: ' + (e as Error).message);
      }
    };
    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
  }

  private makeNavButtons(container: HTMLElement, prev: number | null, next: number | null): void {
    const row = container.createDiv({ cls: 'loner-lw-nav' });
    if (prev !== null) {
      const backBtn = row.createEl('button', { text: '← Back', cls: 'loner-btn' });
      backBtn.addEventListener('click', () => this.renderStep(prev));
    }
    if (next !== null) {
      const nextBtn = row.createEl('button', { text: 'Next →', cls: 'loner-btn loner-btn--primary' });
      nextBtn.addEventListener('click', () => this.renderStep(next));
    }
  }

  private getEntityNotes(type: 'npc' | 'location'): TFile[] {
    return this.app.vault.getMarkdownFiles().filter(f => {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      return fm?.loner_entity === true && fm?.type === type;
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
