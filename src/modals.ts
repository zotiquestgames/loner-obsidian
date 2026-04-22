import { App, Modal, Notice, TFile } from 'obsidian';
import type LonerPlugin from '../main';

export abstract class LonerModal extends Modal {
  constructor(app: App, protected plugin: LonerPlugin) {
    super(app);
  }

  protected async insertIntoActiveNote(content: string): Promise<void> {
    try {
      await this.plugin.insertIntoActiveNote(content);
    } catch (e) {
      new Notice('Loner Assistant: ' + (e as Error).message);
    }
  }

  protected makeLonelogAwareInsertBtn(container: HTMLElement, label: string): HTMLButtonElement {
    const btn = container.createEl('button', { text: label, cls: 'loner-btn loner-btn--insert' });
    if (this.plugin.settings.useLonelog) {
      btn.createSpan({ cls: 'loner-lonelog-badge', text: 'LL' });
    }
    return btn;
  }
}
