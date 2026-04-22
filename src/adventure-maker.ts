import { App } from 'obsidian';
import type LonerPlugin from '../main';
import type { AdventureMakerEntries } from '../main';
import { LonerModal } from './modals';
import { rollDie } from './oracle';
import {
  SETTINGS_TABLE, TONES_TABLE, THINGS_TABLE,
  ACTIONS_TABLE, OPPOSITION_TABLE, FIVEWH_TABLE,
  lookupAdventureMaker,
} from './tables';

export class AdventureMakerModal extends LonerModal {
  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('loner-adventure-maker-modal');
    contentEl.createEl('h2', { text: 'Adventure Maker' });

    // Tab buttons
    const tabRow = contentEl.createDiv({ cls: 'loner-tabs' });
    const settingTab = tabRow.createEl('button', { text: 'Setting', cls: 'loner-tab loner-tab--active' });
    const premiseTab = tabRow.createEl('button', { text: 'Adventure Premise', cls: 'loner-tab' });
    const frameTab = tabRow.createEl('button', { text: '5W+H Frame', cls: 'loner-tab' });

    const settingPanel = contentEl.createDiv({ cls: 'loner-tab-panel' });
    const premisePanel = contentEl.createDiv({ cls: 'loner-tab-panel' });
    premisePanel.style.display = 'none';
    const framePanel = contentEl.createDiv({ cls: 'loner-tab-panel' });
    framePanel.style.display = 'none';

    settingTab.addEventListener('click', () => this.switchTab(settingTab, settingPanel, [premiseTab, frameTab], [premisePanel, framePanel]));
    premiseTab.addEventListener('click', () => this.switchTab(premiseTab, premisePanel, [settingTab, frameTab], [settingPanel, framePanel]));
    frameTab.addEventListener('click', () => this.switchTab(frameTab, framePanel, [settingTab, premiseTab], [settingPanel, premisePanel]));

    this.buildSettingPanel(settingPanel);
    this.buildPremisePanel(premisePanel);
    this.buildFramePanel(framePanel);
  }

  private switchTab(
    activeBtn: HTMLElement,
    activePanel: HTMLElement,
    otherBtns: HTMLElement[],
    otherPanels: HTMLElement[]
  ): void {
    activeBtn.addClass('loner-tab--active');
    activePanel.style.display = 'block';
    otherBtns.forEach(b => b.removeClass('loner-tab--active'));
    otherPanels.forEach(p => { p.style.display = 'none'; });
  }

  private buildSettingPanel(panel: HTMLElement): void {
    panel.createEl('h3', { text: 'Generate a Setting' });

    const entries: Record<string, { label: string; value: string; table: string[][] }> = {
      setting: { label: 'Setting', value: '', table: SETTINGS_TABLE },
      tone:    { label: 'Tone', value: '', table: TONES_TABLE },
      thing1:  { label: 'Thing 1', value: '', table: THINGS_TABLE },
      thing2:  { label: 'Thing 2', value: '', table: THINGS_TABLE },
    };

    const displays: Record<string, HTMLElement> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const row = panel.createDiv({ cls: 'loner-am-entry' });
      row.createEl('span', { text: entry.label + ':', cls: 'loner-am-label' });
      const display = row.createEl('span', { text: '—', cls: 'loner-am-value' });
      displays[key] = display;
      const rerollBtn = row.createEl('button', { text: 'Re-roll', cls: 'loner-btn loner-btn--icon' });
      rerollBtn.addEventListener('click', () => {
        const val = lookupAdventureMaker(entry.table, rollDie(6), rollDie(6));
        entry.value = val;
        display.setText(val);
        updateInsert();
      });
    }

    const rollAllBtn = panel.createEl('button', { text: 'Roll All', cls: 'loner-btn loner-btn--primary' });
    rollAllBtn.addEventListener('click', () => {
      for (const [key, entry] of Object.entries(entries)) {
        const val = lookupAdventureMaker(entry.table, rollDie(6), rollDie(6));
        entry.value = val;
        displays[key].setText(val);
      }
      updateInsert();
    });

    const insertBtn = this.makeLonelogAwareInsertBtn(panel, 'Insert into Note');
    const updateInsert = (): void => {/* button is always clickable */};

    insertBtn.addEventListener('click', async () => {
      const e: AdventureMakerEntries = {
        setting: entries.setting.value || undefined,
        tone: entries.tone.value || undefined,
        things: [entries.thing1.value, entries.thing2.value].filter(Boolean),
      };
      let content: string;
      if (this.plugin.settings.useLonelog) {
        content = this.plugin.lonelogFormatter.formatAdventureMaker(e);
      } else {
        const lines: string[] = [];
        if (e.setting) lines.push(`**Setting**: ${e.setting}`);
        if (e.tone) lines.push(`**Tone**: ${e.tone}`);
        if (e.things?.length) lines.push(`**Things**: ${e.things.join(' · ')}`);
        content = this.plugin.buildCallout('adventure-maker', 'Adventure Setup', lines);
      }
      await this.insertIntoActiveNote(content);
      this.close();
    });
  }

  private buildPremisePanel(panel: HTMLElement): void {
    panel.createEl('h3', { text: 'Generate an Adventure Premise' });

    const entries: Record<string, { label: string; value: string; table: string[][] }> = {
      opposition: { label: 'Opposition', value: '', table: OPPOSITION_TABLE },
      action1:    { label: 'Action 1', value: '', table: ACTIONS_TABLE },
      action2:    { label: 'Action 2', value: '', table: ACTIONS_TABLE },
      thing:      { label: 'Thing', value: '', table: THINGS_TABLE },
    };

    const displays: Record<string, HTMLElement> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const row = panel.createDiv({ cls: 'loner-am-entry' });
      row.createEl('span', { text: entry.label + ':', cls: 'loner-am-label' });
      const display = row.createEl('span', { text: '—', cls: 'loner-am-value' });
      displays[key] = display;
      const rerollBtn = row.createEl('button', { text: 'Re-roll', cls: 'loner-btn loner-btn--icon' });
      rerollBtn.addEventListener('click', () => {
        const val = lookupAdventureMaker(entry.table, rollDie(6), rollDie(6));
        entry.value = val;
        display.setText(val);
      });
    }

    const rollAllBtn = panel.createEl('button', { text: 'Roll All', cls: 'loner-btn loner-btn--primary' });
    rollAllBtn.addEventListener('click', () => {
      for (const [key, entry] of Object.entries(entries)) {
        const val = lookupAdventureMaker(entry.table, rollDie(6), rollDie(6));
        entry.value = val;
        displays[key].setText(val);
      }
    });

    const insertBtn = this.makeLonelogAwareInsertBtn(panel, 'Insert into Note');
    insertBtn.addEventListener('click', async () => {
      const e: AdventureMakerEntries = {
        opposition: entries.opposition.value || undefined,
        actions: [entries.action1.value, entries.action2.value].filter(Boolean),
        things: entries.thing.value ? [entries.thing.value] : undefined,
      };
      let content: string;
      if (this.plugin.settings.useLonelog) {
        content = this.plugin.lonelogFormatter.formatAdventureMaker(e);
      } else {
        const lines: string[] = [];
        if (e.opposition) lines.push(`**Opposition**: ${e.opposition}`);
        if (e.actions?.length) lines.push(`**Actions**: ${e.actions.join(' · ')}`);
        if (e.things?.length) lines.push(`**Things**: ${e.things.join(' · ')}`);
        content = this.plugin.buildCallout('adventure-maker', 'Adventure Premise', lines);
      }
      await this.insertIntoActiveNote(content);
      this.close();
    });
  }

  private buildFramePanel(panel: HTMLElement): void {
    panel.createEl('h3', { text: '5W+H Adventure Frame' });

    const columns = Object.keys(FIVEWH_TABLE);
    const results: Record<string, string> = {};
    const displays: Record<string, HTMLElement> = {};

    for (const col of columns) {
      const row = panel.createDiv({ cls: 'loner-am-entry' });
      row.createEl('span', { text: col + ':', cls: 'loner-am-label' });
      const display = row.createEl('span', { text: '—', cls: 'loner-am-value' });
      displays[col] = display;
      const rerollBtn = row.createEl('button', { text: 'Re-roll', cls: 'loner-btn loner-btn--icon' });
      rerollBtn.addEventListener('click', () => {
        const val = FIVEWH_TABLE[col][rollDie(6) - 1];
        results[col] = val;
        display.setText(val);
      });
    }

    const rollAllBtn = panel.createEl('button', { text: 'Roll All', cls: 'loner-btn loner-btn--primary' });
    rollAllBtn.addEventListener('click', () => {
      for (const col of columns) {
        const val = FIVEWH_TABLE[col][rollDie(6) - 1];
        results[col] = val;
        displays[col].setText(val);
      }
    });

    const insertBtn = this.makeLonelogAwareInsertBtn(panel, 'Insert into Note');
    insertBtn.addEventListener('click', async () => {
      const lines = columns.map(c => `**${c}**: ${results[c] || '—'}`);
      const content = this.plugin.buildCallout('adventure-maker', '5W+H Adventure Frame', lines);
      await this.insertIntoActiveNote(content);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
