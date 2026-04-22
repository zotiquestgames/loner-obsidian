import { Notice, TFile } from 'obsidian';
import type LonerPlugin from '../main';
import { LonerModal } from './modals';

export class GenerateProtagonistModal extends LonerModal {
  constructor(app: import('obsidian').App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Generate Protagonist Note' });
    contentEl.createEl('p', {
      text: 'Fills in YAML frontmatter for a new Protagonist note. Fields comply with Lonelog v1.4.1 PC tag categories.',
      cls: 'loner-wizard-desc',
    });

    // ── String list helper ────────────────────────────────────────────────────
    const makeListField = (
      container: HTMLElement,
      labelText: string,
      defaults: string[]
    ): (() => string[]) => {
      const section = container.createDiv({ cls: 'loner-wizard-list-section' });
      section.createEl('div', { text: labelText, cls: 'loner-field-label' });
      const list = section.createDiv({ cls: 'loner-wizard-list' });

      const items: HTMLInputElement[] = [];

      const addRow = (value = ''): void => {
        const row = list.createDiv({ cls: 'loner-wizard-list-row' });
        const input = row.createEl('input', { type: 'text', cls: 'loner-field-input' });
        input.value = value;
        items.push(input);
        const removeBtn = row.createEl('button', { text: '×', cls: 'loner-btn loner-btn--icon' });
        removeBtn.addEventListener('click', () => {
          items.splice(items.indexOf(input), 1);
          row.remove();
        });
      };

      for (const d of defaults) addRow(d);

      const addBtn = section.createEl('button', { text: `+ Add ${labelText}`, cls: 'loner-btn' });
      addBtn.addEventListener('click', () => addRow());

      return () => items.map(i => i.value.trim()).filter(Boolean);
    };

    // ── Single-line field helper ──────────────────────────────────────────────
    const makeField = (
      container: HTMLElement,
      labelText: string,
      placeholder = ''
    ): HTMLInputElement => {
      const row = container.createDiv({ cls: 'loner-field-row' });
      row.createEl('label', { text: labelText, cls: 'loner-field-label' });
      return row.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder });
    };

    // ── Form ──────────────────────────────────────────────────────────────────
    const form = contentEl.createDiv({ cls: 'loner-wizard-form' });

    contentEl.createEl('h3', { text: 'Identity' });
    const nameInput    = makeField(form, 'Name *',    'Zahra Nakajima');
    const conceptInput = makeField(form, 'Concept',   'Witty Street Cat');
    const goalInput    = makeField(form, 'Goal',      'Obtain unknown technology');
    const motiveInput  = makeField(form, 'Motive',    'Feels responsible for home');
    const nemesisInput = makeField(form, 'Nemesis',   '');

    contentEl.createEl('h3', { text: 'Traits' });
    const getSkills   = makeListField(form, 'Skills',     ['', '']);
    const getGear     = makeListField(form, 'Gear',       ['', '']);
    const getFragilty = makeListField(form, 'Frailties',  ['']);

    contentEl.createEl('h3', { text: 'Stats' });
    const luckRow = form.createDiv({ cls: 'loner-field-row' });
    luckRow.createEl('label', { text: 'Luck max', cls: 'loner-field-label' });
    const luckMaxInput = luckRow.createEl('input', { type: 'number', cls: 'loner-field-input loner-field-input--short' });
    luckMaxInput.value = '6';
    luckMaxInput.min = '1';
    luckMaxInput.max = '20';

    contentEl.createEl('h3', { text: 'Note' });
    const pathRow = form.createDiv({ cls: 'loner-field-row' });
    pathRow.createEl('label', { text: 'Note path *', cls: 'loner-field-label' });
    const pathInput = pathRow.createEl('input', { type: 'text', cls: 'loner-field-input' });
    pathInput.placeholder = 'Characters/Zahra.md';
    pathInput.value = this.plugin.settings.protagonistNotePath || '';
    pathRow.createEl('span', { text: 'Will be set as your active Protagonist note.', cls: 'loner-wizard-hint' });

    // ── Buttons ───────────────────────────────────────────────────────────────
    const btnRow = contentEl.createDiv({ cls: 'loner-wizard-btn-row' });

    const createBtn = btnRow.createEl('button', { text: 'Create Note', cls: 'loner-btn loner-btn--primary' });
    const insertBtn = btnRow.createEl('button', { text: 'Insert into Active Note', cls: 'loner-btn' });
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel', cls: 'loner-btn' });

    cancelBtn.addEventListener('click', () => this.close());

    const buildFrontmatter = (): string | null => {
      const name = nameInput.value.trim();
      if (!name) { new Notice('Name is required.'); return null; }

      const luckMax   = parseInt(luckMaxInput.value) || 6;
      const skills    = getSkills();
      const gear      = getGear();
      const frailties = getFragilty();

      const lines: string[] = ['---', 'loner_protagonist: true'];

      lines.push(`name: ${JSON.stringify(name)}`);
      lines.push(`concept: ${JSON.stringify(conceptInput.value.trim())}`);

      const arrayBlock = (key: string, arr: string[]): void => {
        if (arr.length) {
          lines.push(`${key}:`);
          for (const v of arr) lines.push(`  - ${JSON.stringify(v)}`);
        } else {
          lines.push(`${key}: []`);
        }
      };

      arrayBlock('skill', skills);
      arrayBlock('gear', gear);
      arrayBlock('frailty', frailties);

      lines.push(`goal: ${JSON.stringify(goalInput.value.trim())}`);
      lines.push(`motive: ${JSON.stringify(motiveInput.value.trim())}`);
      lines.push(`nemesis: ${JSON.stringify(nemesisInput.value.trim())}`);
      lines.push(`luck: ${luckMax}`);
      lines.push(`luck_max: ${luckMax}`);
      lines.push('tags: []');
      lines.push('relationship_tags: []');
      lines.push('leverage: null');
      lines.push('twist_counter: 0');
      lines.push('challenge_tracks: []');
      lines.push('status_tracks: []');
      lines.push('---');
      lines.push('');

      return lines.join('\n');
    };

    createBtn.addEventListener('click', async () => {
      const fm = buildFrontmatter();
      if (!fm) return;

      const path = pathInput.value.trim();
      if (!path) { new Notice('Note path is required.'); return; }

      try {
        let file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
        if (file instanceof TFile) {
          // Prepend to existing note (replace existing frontmatter if present)
          const existing = await this.app.vault.read(file);
          const withoutFm = existing.replace(/^---[\s\S]*?---\n?/, '');
          await this.app.vault.modify(file, fm + withoutFm);
        } else {
          // Ensure parent folder exists
          const parts = path.split('/');
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join('/');
            try { await this.app.vault.createFolder(dir); } catch { /* already exists */ }
          }
          file = await this.app.vault.create(path, fm);
        }

        this.plugin.settings.protagonistNotePath = path;
        this.plugin.protagonistSheet = new (await import('./protagonist-sheet')).ProtagonistSheet(
          this.app, this.plugin.settings
        );
        await this.plugin.saveSettings();
        this.plugin.refreshProtagonistView();

        this.app.workspace.getLeaf(false).openFile(file);
        new Notice(`Protagonist note ready: ${path}`);
        this.close();
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    insertBtn.addEventListener('click', async () => {
      const fm = buildFrontmatter();
      if (!fm) return;

      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) { new Notice('No active note.'); return; }

      try {
        const existing = await this.app.vault.read(activeFile);
        const withoutFm = existing.replace(/^---[\s\S]*?---\n?/, '');
        await this.app.vault.modify(activeFile, fm + withoutFm);

        if (!this.plugin.settings.protagonistNotePath) {
          this.plugin.settings.protagonistNotePath = activeFile.path;
          this.plugin.protagonistSheet = new (await import('./protagonist-sheet')).ProtagonistSheet(
            this.app, this.plugin.settings
          );
          await this.plugin.saveSettings();
          this.plugin.refreshProtagonistView();
        }

        new Notice('Frontmatter inserted.');
        this.close();
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });
  }

  onClose(): void { this.contentEl.empty(); }
}
