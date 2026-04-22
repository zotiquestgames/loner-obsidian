import { Notice } from 'obsidian';
import type LonerPlugin from '../main';

export function renderLeverageSection(container: HTMLElement, plugin: LonerPlugin): void {
  const details = container.createEl('details', { cls: 'loner-section' });
  details.setAttribute('open', '');
  details.createEl('summary', { text: 'Leverage', cls: 'loner-section-title' });
  const section = details.createDiv({ cls: 'loner-section-content loner-leverage-section' });

  plugin.protagonistSheet.getLeverage()
    .then(leverage => renderState(section, plugin, leverage))
    .catch(e => section.createEl('p', { text: (e as Error).message, cls: 'loner-error' }));
}

function renderState(section: HTMLElement, plugin: LonerPlugin, leverage: string | null): void {
  section.empty();

  if (!leverage) {
    renderEmptyState(section, plugin);
  } else {
    renderHeldState(section, plugin, leverage);
  }
}

function renderEmptyState(section: HTMLElement, plugin: LonerPlugin): void {
  const desc = section.createEl('p', { cls: 'loner-leverage-desc' });
  desc.setText('No leverage held.');

  const lastResult = plugin.lastOracleResult;
  const canBank = lastResult?.label === 'Yes, and...';

  const bankBtn = section.createEl('button', {
    text: 'Bank Leverage',
    cls: 'loner-btn' + (canBank ? '' : ' loner-btn--disabled'),
  });
  bankBtn.disabled = !canBank;
  bankBtn.title = canBank
    ? 'Bank this Yes, and... result as Leverage.'
    : 'Leverage can only be banked on a Yes, and... result.';

  if (canBank) {
    const inputRow = section.createDiv({ cls: 'loner-leverage-input-row' });
    inputRow.style.display = 'none';
    const input = inputRow.createEl('input', {
      type: 'text',
      cls: 'loner-field-input',
      placeholder: 'Describe the leverage…',
    });
    const confirmBtn = inputRow.createEl('button', { text: 'Confirm', cls: 'loner-btn loner-btn--primary' });

    bankBtn.addEventListener('click', () => {
      inputRow.style.display = 'flex';
      input.focus();
    });

    const doBank = async (): Promise<void> => {
      const val = input.value.trim();
      if (!val) return;
      try {
        await plugin.protagonistSheet.setLeverage(val);
        if (plugin.settings.useLonelog) {
          try {
            const file = plugin.app.workspace.getActiveFile();
            if (file) {
              const content = plugin.lonelogFormatter.formatLeverage(val, 'held');
              await plugin.insertIntoActiveNote(content);
            }
          } catch { /* best effort */ }
        }
        renderState(section, plugin, val);
      } catch (e) {
        new Notice('Loner 4e: ' + (e as Error).message);
      }
    };

    confirmBtn.addEventListener('click', doBank);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doBank(); });
  }
}

function renderHeldState(section: HTMLElement, plugin: LonerPlugin, leverage: string): void {
  section.createEl('p', { text: `Held: "${leverage}"`, cls: 'loner-leverage-held' });

  const btnRow = section.createDiv({ cls: 'loner-leverage-btn-row' });

  // Spend as Advantage — only queues the flag; leverage is consumed at roll-time
  const spendAdvBtn = btnRow.createEl('button', { text: 'Spend as Advantage', cls: 'loner-btn loner-btn--primary' });
  spendAdvBtn.disabled = plugin.leverageAdvantageActive;
  spendAdvBtn.addEventListener('click', () => {
    plugin.leverageAdvantageActive = true;
    new Notice('Leverage queued. Next oracle roll will use Advantage (if not already).');
    spendAdvBtn.disabled = true;
    spendAdvBtn.setText('Spend as Advantage (queued)');
  });

  // Convert No to No, but...
  const convertBtn = btnRow.createEl('button', { text: 'Convert No → No, but...', cls: 'loner-btn' });
  convertBtn.title = 'Clears Leverage. Apply the No, but... interpretation to your next No result.';
  convertBtn.addEventListener('click', async () => {
    try {
      await plugin.protagonistSheet.setLeverage(null);
      new Notice('Leverage spent. Apply No, but... to the next No result manually.');
      renderState(section, plugin, null);
      plugin.refreshProtagonistView();
    } catch (e) {
      new Notice('Loner 4e: ' + (e as Error).message);
    }
  });

  // Discard
  const discardBtn = btnRow.createEl('button', { text: 'Discard', cls: 'loner-btn loner-btn--danger' });
  discardBtn.title = 'Expires leverage without spending it.';
  discardBtn.addEventListener('click', async () => {
    try {
      await plugin.protagonistSheet.setLeverage(null);
      if (plugin.settings.useLonelog) {
        try {
          const file = plugin.app.workspace.getActiveFile();
          if (file) await plugin.insertIntoActiveNote(plugin.lonelogFormatter.formatLeverage(leverage, 'expired'));
        } catch { /* best effort */ }
      }
      renderState(section, plugin, null);
      plugin.refreshProtagonistView();
    } catch (e) {
      new Notice('Loner 4e: ' + (e as Error).message);
    }
  });
}
