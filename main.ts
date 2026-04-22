import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import { ProtagonistSheet } from './src/protagonist-sheet';
import { VIEW_TYPE_PROTAGONIST, ProtagonistView } from './src/protagonist-view';
import { rollOracleWithMode, resolveOracle } from './src/oracle';
import { lookupTwist, getTwistIntensityNote } from './src/twist';
import { rollSceneTransition, MeanwhileModal } from './src/scene';
import { InspirationModal } from './src/inspiration';
import { AdventureMakerModal } from './src/adventure-maker';
import { LivingWorldModal } from './src/living-world';
import { LonelogFormatter, LonelogSession, insertLonelogIntoNote, InsertNpcTagModal, InsertLocationTagModal, StartSessionLogModal } from './src/lonelog';
import { renderOracleWidget } from './src/oracle-widget';
import { renderChallengeTrackBlock, renderStatusTrackBlock } from './src/tracks';

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface LonerSettings {
  protagonistNotePath: string;
  useChallengeTracks: boolean;
  useLeverage: boolean;
  useStatusTrack: boolean;
  useStepDice: boolean;
  insertResultsIntoNote: boolean;
  resultCalloutStyle: 'callout' | 'blockquote' | 'plain';
  useLonelog: boolean;
  lonelogSessionNotePath: string;
}

export interface OracleResult {
  result: 'Yes' | 'No';
  modifier: 'and' | 'but' | null;
  isDouble: boolean;
  label: string;
  luckDamage: { target: 'opponent' | 'protagonist'; amount: number };
}

export interface OracleRollDetail {
  chance: number;
  chanceSides: number;
  risk: number;
  riskSides: number;
}

export interface ChallengeTrack {
  id: string;
  label: string;
  boxes: [boolean, boolean, boolean, boolean];
  reversed: boolean;
}

export interface StatusTrack {
  id: string;
  label: string;
  type: 'physical' | 'social' | 'psychological';
  boxes: [boolean, boolean, boolean];
  tags: [string, string, string];
}

export interface ProtagonistData {
  loner_protagonist: boolean;
  name: string;
  concept: string;
  frailty: string;
  skills: string[];
  gear: string[];
  goal: string;
  motive: string;
  nemesis: string;
  luck: number;
  luck_max: number;
  tags: string[];
  relationship_tags: string[];
  leverage: string | null;
  twist_counter: number;
  challenge_tracks: ChallengeTrack[];
  status_tracks: StatusTrack[];
}

export interface AdventureMakerEntries {
  setting?: string;
  tone?: string;
  things?: string[];
  opposition?: string;
  actions?: string[];
}

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: LonerSettings = {
  protagonistNotePath: '',
  useChallengeTracks: true,
  useLeverage: true,
  useStatusTrack: true,
  useStepDice: false,
  insertResultsIntoNote: true,
  resultCalloutStyle: 'callout',
  useLonelog: false,
  lonelogSessionNotePath: '',
};

// ─── Plugin Class ─────────────────────────────────────────────────────────────

export default class LonerPlugin extends Plugin {
  settings!: LonerSettings;
  protagonistSheet!: ProtagonistSheet;
  twistCounterEl!: HTMLElement;

  // Ephemeral session state — never persisted to disk
  lastOracleResult: OracleResult | null = null;
  leverageAdvantageActive = false;
  conflictModeActive = false;
  lonelogSession: LonelogSession = {
    mentionedNpcs: new Set(),
    mentionedLocations: new Set(),
  };
  lonelogFormatter!: LonelogFormatter;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.protagonistSheet = new ProtagonistSheet(this.app, this.settings);
    this.lonelogFormatter = new LonelogFormatter(this.lonelogSession);

    // Status bar — Twist Counter
    this.twistCounterEl = this.addStatusBarItem();
    this.twistCounterEl.addClass('loner-twist-counter');
    this.twistCounterEl.setText('🔄 Twist: 0/3');
    this.twistCounterEl.title = 'Loner 4e Twist Counter';

    // Initialize twist counter from frontmatter if protagonist is configured
    if (this.settings.protagonistNotePath) {
      this.protagonistSheet.getTwistCounter()
        .then(n => this.updateTwistStatusBar(n))
        .catch(() => {/* protagonist note not found yet */});
    }

    // Ribbon icon
    this.addRibbonIcon('dice', 'Open Protagonist Sheet', () => {
      this.activateProtagonistView();
    });

    // Register sidebar view
    this.registerView(VIEW_TYPE_PROTAGONIST, (leaf) => new ProtagonistView(leaf, this));

    // Code block processors
    this.registerMarkdownCodeBlockProcessor('loner-oracle', (source, el, ctx) => {
      renderOracleWidget(el, this, ctx);
    });

    this.registerMarkdownCodeBlockProcessor('loner-track', (source, el, ctx) => {
      renderChallengeTrackBlock(source, el, ctx, this);
    });

    this.registerMarkdownCodeBlockProcessor('loner-status', (source, el, ctx) => {
      renderStatusTrackBlock(source, el, ctx, this);
    });

    // Commands
    this.addCommand({
      id: 'open-protagonist-sheet',
      name: 'Open Protagonist Sheet',
      callback: () => this.activateProtagonistView(),
    });

    this.addCommand({
      id: 'scene-transition',
      name: 'Loner: Roll Scene Transition',
      callback: () => {
        const result = rollSceneTransition();
        if (result.type === 'meanwhile') {
          new MeanwhileModal(this.app, this, result).open();
        } else {
          new SceneResultModal(this.app, this, result).open();
        }
      },
    });

    this.addCommand({
      id: 'inspiration',
      name: 'Loner: Roll Inspiration',
      callback: () => new InspirationModal(this.app, this).open(),
    });

    this.addCommand({
      id: 'adventure-maker',
      name: 'Loner: Adventure Maker',
      callback: () => new AdventureMakerModal(this.app, this).open(),
    });

    this.addCommand({
      id: 'living-world',
      name: 'Loner: Living World — End of Session',
      callback: () => new LivingWorldModal(this.app, this).open(),
    });

    // Lonelog commands — registered always; early-return if disabled
    this.addCommand({
      id: 'lonelog-export-protagonist',
      name: 'Loner: Export Protagonist as Lonelog Tag',
      callback: () => this.lonelogExportProtagonist(),
    });

    this.addCommand({
      id: 'lonelog-insert-npc-tag',
      name: 'Loner: Insert NPC Tag',
      callback: () => {
        if (!this.settings.useLonelog) { new Notice('Enable Lonelog in Loner 4e settings.'); return; }
        new InsertNpcTagModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'lonelog-insert-location-tag',
      name: 'Loner: Insert Location Tag',
      callback: () => {
        if (!this.settings.useLonelog) { new Notice('Enable Lonelog in Loner 4e settings.'); return; }
        new InsertLocationTagModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'lonelog-start-session',
      name: 'Loner: Start Session Log',
      callback: () => {
        if (!this.settings.useLonelog) { new Notice('Enable Lonelog in Loner 4e settings.'); return; }
        new StartSessionLogModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'lonelog-reset-session',
      name: 'Loner: Reset Lonelog Session Tracking',
      callback: () => {
        if (!this.settings.useLonelog) { new Notice('Enable Lonelog in Loner 4e settings.'); return; }
        this.lonelogSession.mentionedNpcs.clear();
        this.lonelogSession.mentionedLocations.clear();
        new Notice('Lonelog session tracking reset.');
      },
    });

    this.addSettingTab(new LonerSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PROTAGONIST);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateProtagonistView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROTAGONIST);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_PROTAGONIST, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  // ─── Twist Counter ──────────────────────────────────────────────────────────

  updateTwistStatusBar(n: number): void {
    this.twistCounterEl.setText(`🔄 Twist: ${n}/3`);
    this.twistCounterEl.removeClass('loner-twist-counter--warning');
    this.twistCounterEl.removeClass('loner-twist-counter--trigger');
    if (n === 2) this.twistCounterEl.addClass('loner-twist-counter--warning');
    if (n >= 3) this.twistCounterEl.addClass('loner-twist-counter--trigger');
  }

  async incrementTwistCounter(): Promise<{ triggered: boolean; subject?: string; action?: string; intensityNote?: string }> {
    let n: number;
    try {
      n = await this.protagonistSheet.getTwistCounter();
    } catch {
      new Notice('Loner 4e: No protagonist note configured.');
      return { triggered: false };
    }

    n += 1;

    if (n >= 3) {
      // Clear Leverage BEFORE displaying the Twist result
      await this.protagonistSheet.setLeverage(null);
      await this.protagonistSheet.setTwistCounter(0);

      const subjectRoll = Math.floor(Math.random() * 6) + 1;
      const actionRoll = Math.floor(Math.random() * 6) + 1;
      const { subject, action } = lookupTwist(subjectRoll, actionRoll);

      let luck = 6;
      let statusBoxesFilled = 0;
      try {
        luck = await this.protagonistSheet.getLuck();
        const tracks = await this.protagonistSheet.getStatusTracks();
        statusBoxesFilled = tracks.reduce((sum, t) => sum + t.boxes.filter(Boolean).length, 0);
      } catch { /* best effort */ }

      const intensityNote = getTwistIntensityNote(luck, statusBoxesFilled);

      this.updateTwistStatusBar(0);
      this.refreshProtagonistView();

      new Notice(`⚡ Twist: ${subject} / ${action}\n${intensityNote}`, 8000);

      return { triggered: true, subject, action, intensityNote };
    } else {
      await this.protagonistSheet.setTwistCounter(n);
      this.updateTwistStatusBar(n);
      this.refreshProtagonistView();
      return { triggered: false };
    }
  }

  refreshProtagonistView(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROTAGONIST);
    for (const leaf of leaves) {
      (leaf.view as ProtagonistView).refresh();
    }
  }

  // ─── Output Helpers ─────────────────────────────────────────────────────────

  buildCallout(type: string, title: string, lines: string[]): string {
    if (this.settings.resultCalloutStyle === 'plain') {
      return [title, ...lines].join('\n');
    }
    if (this.settings.resultCalloutStyle === 'blockquote') {
      return [`> **${title}**`, ...lines.map(l => `> ${l}`)].join('\n');
    }
    // default: callout
    const body = lines.map(l => `> ${l}`).join('\n');
    return `> [!${type}] ${title}\n${body}`;
  }

  async insertIntoActiveNote(content: string): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) { new Notice('No active note.'); return; }

    if (this.settings.useLonelog) {
      await insertLonelogIntoNote(this.app, content, activeFile);
    } else {
      const fileContent = await this.app.vault.read(activeFile);
      await this.app.vault.modify(activeFile, fileContent + '\n' + content + '\n');
    }
  }

  private async lonelogExportProtagonist(): Promise<void> {
    if (!this.settings.useLonelog) { new Notice('Enable Lonelog in Loner 4e settings.'); return; }
    try {
      const data = await this.protagonistSheet.read();
      const tag = this.lonelogFormatter.formatProtagonistTag(data);
      await this.insertIntoActiveNote(tag);
    } catch (e) {
      new Notice('Loner 4e: ' + (e as Error).message);
    }
  }
}

// ─── Scene Result Modal (minimal, for non-meanwhile results) ─────────────────

import { Modal, MarkdownPostProcessorContext } from 'obsidian';

class SceneResultModal extends Modal {
  constructor(
    app: App,
    private plugin: LonerPlugin,
    private result: { roll: number; type: string; label: string }
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Scene Transition' });

    const resultEl = contentEl.createDiv('loner-scene-result');
    resultEl.createEl('p', { text: `Roll: ${this.result.roll}` });
    const badge = resultEl.createEl('div', { cls: `loner-scene-badge loner-scene-badge--${this.result.type}` });
    badge.setText(this.result.label);

    const desc = {
      dramatic: 'Stakes rise, new obstacles emerge.',
      quiet: 'Protagonist has initiative — recovery, planning, relationships.',
      meanwhile: '',
    }[this.result.type] ?? '';
    if (desc) resultEl.createEl('p', { text: desc, cls: 'loner-scene-description' });

    const insertBtn = contentEl.createEl('button', { text: 'Insert into Note' });
    if (this.plugin.settings.useLonelog) {
      insertBtn.createSpan({ cls: 'loner-lonelog-badge', text: 'LL' });
    }
    insertBtn.addEventListener('click', async () => {
      let content: string;
      if (this.plugin.settings.useLonelog) {
        content = this.plugin.lonelogFormatter.formatSceneTransition(this.result.roll, this.result.label);
      } else {
        content = this.plugin.buildCallout(
          'scene',
          this.result.label,
          desc ? [desc] : []
        );
      }
      await this.plugin.insertIntoActiveNote(content);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class LonerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LonerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Loner 4e Settings' });

    new Setting(containerEl)
      .setName('Protagonist note path')
      .setDesc('Path to the active Protagonist sheet note (e.g. "Characters/Zahra.md").')
      .addText(text => text
        .setPlaceholder('Characters/Protagonist.md')
        .setValue(this.plugin.settings.protagonistNotePath)
        .onChange(async (value) => {
          this.plugin.settings.protagonistNotePath = value;
          this.plugin.protagonistSheet = new ProtagonistSheet(this.plugin.app, this.plugin.settings);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Challenge Tracks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useChallengeTracks)
        .onChange(async (value) => {
          this.plugin.settings.useChallengeTracks = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Leverage')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useLeverage)
        .onChange(async (value) => {
          this.plugin.settings.useLeverage = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Status Track')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useStatusTrack)
        .onChange(async (value) => {
          this.plugin.settings.useStatusTrack = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Use Step Dice Oracle (Appendix D)')
      .setDesc('Replace Advantage/Disadvantage dice pool with step-up dice (d6 → d8 → d10).')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useStepDice)
        .onChange(async (value) => {
          this.plugin.settings.useStepDice = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-insert results into note')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.insertResultsIntoNote)
        .onChange(async (value) => {
          this.plugin.settings.insertResultsIntoNote = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Result callout style')
      .addDropdown(drop => drop
        .addOption('callout', 'Obsidian callout')
        .addOption('blockquote', 'Blockquote')
        .addOption('plain', 'Plain text')
        .setValue(this.plugin.settings.resultCalloutStyle)
        .onChange(async (value) => {
          this.plugin.settings.resultCalloutStyle = value as LonerSettings['resultCalloutStyle'];
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Lonelog output mode')
      .setDesc('Output session-log notation (Lonelog v1.4.1) instead of Obsidian callouts.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useLonelog)
        .onChange(async (value) => {
          this.plugin.settings.useLonelog = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Lonelog session note path')
      .setDesc('Path to the active session log note for Lonelog output.')
      .addText(text => text
        .setPlaceholder('Sessions/Session-01.md')
        .setValue(this.plugin.settings.lonelogSessionNotePath)
        .onChange(async (value) => {
          this.plugin.settings.lonelogSessionNotePath = value;
          await this.plugin.saveSettings();
        }));
  }
}
