import { App, Modal, Notice, TFile } from 'obsidian';
import type LonerPlugin from '../main';
import type {
  OracleResult, ProtagonistData, ChallengeTrack, StatusTrack, AdventureMakerEntries,
} from '../main';
import type { RollWithMode } from './oracle';
import { LonerModal } from './modals';

// ─── Session Tracking ─────────────────────────────────────────────────────────

export interface LonelogSession {
  mentionedNpcs: Set<string>;
  mentionedLocations: Set<string>;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

export class LonelogFormatter {
  constructor(private session: LonelogSession) {}

  formatOracle(question: string, roll: RollWithMode, result: OracleResult): string {
    const lines: string[] = [];
    if (question) lines.push(`? ${question}`);

    let diceStr: string;
    if (roll.chanceSides !== 6 || roll.riskSides !== 6) {
      diceStr = `Chance d${roll.chanceSides}=${roll.chance} · Risk d${roll.riskSides}=${roll.risk}`;
    } else {
      diceStr = `Chance ${roll.chance} · Risk ${roll.risk}`;
    }

    let damageStr = '';
    if (result.luckDamage.amount > 0) {
      damageStr = result.luckDamage.target === 'protagonist'
        ? ` (Take ${result.luckDamage.amount})`
        : ` (Deal ${result.luckDamage.amount} to opponent)`;
    }

    lines.push(`d: ${diceStr} -> ${result.label}${damageStr}`);
    lines.push('=>');
    return lines.join('\n');
  }

  formatTwist(subject: string, action: string, pressure: 'high' | 'clean'): string {
    const lines = [
      `gen: Twist 2d6 -> ${subject} / ${action}`,
      `(note: ${pressure === 'high' ? 'High pressure — interpret at maximum disruption.' : 'Clean state — interpret as a shift, not a collapse.'})`,
      '=>',
    ];
    return lines.join('\n');
  }

  formatSceneTransition(roll: number, sceneType: string): string {
    if (sceneType.toLowerCase().includes('meanwhile')) {
      return [
        `tbl: Scene Transition d6=${roll} -> Meanwhile`,
        '(note: Update opposition tags. Ask: Does an ally act independently?)',
      ].join('\n');
    }
    return `tbl: Scene Transition d6=${roll} -> ${sceneType}`;
  }

  formatInspiration(verb: string, noun: string, adjective?: string): string {
    const parts = [verb, noun];
    if (adjective) parts.push(adjective);
    return [`gen: Inspiration -> ${parts.join(' · ')}`, '=>'].join('\n');
  }

  formatAdventureMaker(entries: AdventureMakerEntries): string {
    const lines = ['gen: Adventure Maker'];
    if (entries.setting) lines.push(`  Setting: ${entries.setting}`);
    if (entries.tone) lines.push(`  Tone: ${entries.tone}`);
    if (entries.things?.length) lines.push(`  Things: ${entries.things.join(' · ')}`);
    if (entries.opposition) lines.push(`  Opposition: ${entries.opposition}`);
    if (entries.actions?.length) lines.push(`  Actions: ${entries.actions.join(' · ')}`);
    return lines.join('\n');
  }

  formatProtagonistTag(data: ProtagonistData): string {
    const parts = [`PC:${data.name}`];
    if (data.concept) parts.push(`concept:${data.concept}`);
    if (data.skills?.length) parts.push(`skill:${data.skills.join(',')}`);
    if (data.frailty) parts.push(`frailty:${data.frailty}`);
    if (data.gear?.length) parts.push(`gear:${data.gear.join(',')}`);
    parts.push(`luck:${data.luck}`);
    const tag = `[${parts.join('|')}]`;

    const extras: string[] = [];
    if (data.challenge_tracks?.length) {
      for (const t of data.challenge_tracks) {
        extras.push(this.formatChallengeTrackState(t));
      }
    }
    if (data.status_tracks?.length) {
      for (const t of data.status_tracks) {
        extras.push(this.formatStatusTrackState(t));
      }
    }
    return [tag, ...extras].join('\n');
  }

  formatNpcTag(name: string, tags: string[], isFirstMention: boolean): string {
    const alreadyMentioned = this.session.mentionedNpcs.has(name);

    if (!alreadyMentioned || isFirstMention) {
      this.session.mentionedNpcs.add(name);
      if (tags.length > 0) {
        return `[N:${name}|${tags.join('|')}]`;
      }
      return `[N:${name}]`;
    }

    // Already mentioned — check if tags changed
    if (tags.length > 0) {
      // State change: output full form
      return `[N:${name}|${tags.join('|')}]`;
    }
    return `[#N:${name}]`;
  }

  formatLocationTag(name: string, tags: string[]): string {
    const alreadyMentioned = this.session.mentionedLocations.has(name);

    if (!alreadyMentioned) {
      this.session.mentionedLocations.add(name);
      if (tags.length > 0) {
        return `[L:${name}|${tags.join('|')}]`;
      }
      return `[L:${name}]`;
    }

    if (tags.length > 0) {
      return `[L:${name}|${tags.join('|')}]`;
    }
    return `[#L:${name}]`;
  }

  formatChallengeTrackState(track: ChallengeTrack): string {
    const filled = track.boxes.filter(Boolean).length;
    const total = track.boxes.length;
    const keyword = track.reversed ? 'Clock' : 'Track';
    return `[${keyword}:${track.label} ${filled}/${total}]`;
  }

  formatStatusTrackState(track: StatusTrack): string {
    const filled = track.boxes.filter(Boolean).length;
    const total = track.boxes.length;
    const activeTag = filled > 0 ? track.tags[filled - 1] : null;
    const base = `[Clock:${track.label} ${filled}/${total}]`;
    if (activeTag) {
      return `${base}\n(note: Active tag: ${activeTag})`;
    }
    return base;
  }

  formatLeverage(description: string, state: 'held' | 'spent' | 'expired'): string {
    switch (state) {
      case 'held':    return `(note: Leverage held: ${description})`;
      case 'spent':   return `(note: Leverage spent as Advantage)`;
      case 'expired': return `(note: Leverage expired: ${description})`;
    }
  }

  formatSessionHeader(date: string, duration?: string): string {
    const meta = duration ? `Date: ${date} | Duration: ${duration}` : `Date: ${date}`;
    return `*${meta}*`;
  }

  formatSceneHeader(number: string, description: string): string {
    return `### S${number} *${description}*`;
  }
}

// ─── Insertion Logic ──────────────────────────────────────────────────────────

export async function insertLonelogIntoNote(
  app: App,
  content: string,
  targetFile: TFile
): Promise<void> {
  const fileContent = await app.vault.read(targetFile);
  const lines = fileContent.split('\n');

  const cursor = app.workspace.activeEditor?.editor?.getCursor();

  if (cursor) {
    const cursorLine = cursor.line;
    // Scan upward for opening fence
    let insideFence = false;
    for (let i = cursorLine; i >= 0; i--) {
      if (lines[i].trimStart().startsWith('```')) {
        // Check downward from this fence for a closing fence past cursor
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trimStart().startsWith('```')) {
            if (j > cursorLine) {
              insideFence = true;
            }
            break;
          }
        }
        break;
      }
    }

    const insertionLine = cursorLine;
    const before = lines.slice(0, insertionLine + 1).join('\n');
    const after = lines.slice(insertionLine + 1).join('\n');

    let insertText: string;
    if (insideFence) {
      insertText = '\n' + content;
    } else {
      insertText = '\n```\n' + content + '\n```';
    }

    await app.vault.modify(targetFile, before + insertText + (after ? '\n' + after : ''));
  } else {
    // No active cursor — append to end of file
    const wrapped = '\n```\n' + content + '\n```\n';
    await app.vault.modify(targetFile, fileContent + wrapped);
  }
}

// ─── Lonelog-only Modals ──────────────────────────────────────────────────────

export class InsertNpcTagModal extends LonerModal {
  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Insert NPC Tag' });

    const nameRow = contentEl.createDiv({ cls: 'loner-field-row' });
    nameRow.createEl('label', { text: 'NPC Name:', cls: 'loner-field-label' });
    const nameInput = nameRow.createEl('input', { type: 'text', cls: 'loner-field-input' });

    const tagsRow = contentEl.createDiv({ cls: 'loner-field-row' });
    tagsRow.createEl('label', { text: 'Tags (comma-separated):', cls: 'loner-field-label' });
    const tagsInput = tagsRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'hacker, trusted' });

    const firstMentionRow = contentEl.createDiv({ cls: 'loner-field-row' });
    const firstMentionLabel = firstMentionRow.createEl('label');
    const firstMentionCheck = firstMentionLabel.createEl('input', { type: 'checkbox' });
    firstMentionCheck.checked = true;
    firstMentionLabel.appendText(' First mention');

    // Auto-detect first mention when name changes
    nameInput.addEventListener('input', () => {
      const isFirst = !this.plugin.lonelogSession.mentionedNpcs.has(nameInput.value.trim());
      firstMentionCheck.checked = isFirst;
    });

    const insertBtn = contentEl.createEl('button', { text: 'Insert', cls: 'loner-btn loner-btn--primary' });
    insertBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
      const tag = this.plugin.lonelogFormatter.formatNpcTag(name, tags, firstMentionCheck.checked);
      await this.insertIntoActiveNote(tag);
      this.close();
    });
  }

  onClose(): void { this.contentEl.empty(); }
}

export class InsertLocationTagModal extends LonerModal {
  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Insert Location Tag' });

    const nameRow = contentEl.createDiv({ cls: 'loner-field-row' });
    nameRow.createEl('label', { text: 'Location Name:', cls: 'loner-field-label' });
    const nameInput = nameRow.createEl('input', { type: 'text', cls: 'loner-field-input' });

    const tagsRow = contentEl.createDiv({ cls: 'loner-field-row' });
    tagsRow.createEl('label', { text: 'Tags (comma-separated):', cls: 'loner-field-label' });
    const tagsInput = tagsRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'crowded, rain-slicked' });

    const insertBtn = contentEl.createEl('button', { text: 'Insert', cls: 'loner-btn loner-btn--primary' });
    insertBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
      const tag = this.plugin.lonelogFormatter.formatLocationTag(name, tags);
      await this.insertIntoActiveNote(tag);
      this.close();
    });
  }

  onClose(): void { this.contentEl.empty(); }
}

export class StartSessionLogModal extends LonerModal {
  constructor(app: App, plugin: LonerPlugin) {
    super(app, plugin);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Start Session Log' });

    const today = new Date().toISOString().split('T')[0];

    const fields = [
      { key: 'session', label: 'Session number', placeholder: '1' },
      { key: 'date', label: 'Date', placeholder: today, default: today },
      { key: 'duration', label: 'Duration (optional)', placeholder: '1h30' },
      { key: 'sceneNumber', label: 'Opening scene number', placeholder: '1' },
      { key: 'sceneDesc', label: 'Opening scene description', placeholder: 'The dark alley behind the market' },
    ];

    const values: Record<string, string> = { date: today };
    for (const f of fields) {
      const row = contentEl.createDiv({ cls: 'loner-field-row' });
      row.createEl('label', { text: f.label + ':', cls: 'loner-field-label' });
      const input = row.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: f.placeholder });
      if (f.default) input.value = f.default;
      input.addEventListener('input', () => { values[f.key] = input.value; });
    }

    const exportPcRow = contentEl.createDiv({ cls: 'loner-field-row' });
    const exportPcLabel = exportPcRow.createEl('label');
    const exportPcCheck = exportPcLabel.createEl('input', { type: 'checkbox' });
    exportPcCheck.checked = true;
    exportPcLabel.appendText(' Export Protagonist tag');

    const startBtn = contentEl.createEl('button', { text: 'Start Session', cls: 'loner-btn loner-btn--primary' });
    startBtn.addEventListener('click', async () => {
      const sessionNum = values.session ?? '1';
      const date = values.date ?? today;
      const duration = values.duration;
      const sceneNum = values.sceneNumber ?? '1';
      const sceneDesc = values.sceneDesc ?? '';

      const headerLine = `## Session ${sessionNum}`;
      const metaLine = this.plugin.lonelogFormatter.formatSessionHeader(date, duration);
      const sceneHeaderLine = this.plugin.lonelogFormatter.formatSceneHeader(sceneNum, sceneDesc);

      let pcTag = '';
      if (exportPcCheck.checked) {
        try {
          const data = await this.plugin.protagonistSheet.read();
          pcTag = this.plugin.lonelogFormatter.formatProtagonistTag(data);
        } catch { /* no protagonist set */ }
      }

      const noteContent = [
        headerLine,
        metaLine,
        '',
        sceneHeaderLine,
        '',
        pcTag ? '```\n' + pcTag + '\n```' : '',
        '',
      ].filter(l => l !== undefined).join('\n');

      // Determine target note
      let targetPath = this.plugin.settings.lonelogSessionNotePath;
      if (!targetPath) {
        targetPath = `Sessions/Session-${sessionNum.padStart(2, '0')}.md`;
      }

      try {
        let file = this.plugin.app.vault.getAbstractFileByPath(targetPath) as TFile | null;
        if (!file) {
          // Create parent dirs if needed
          const parts = targetPath.split('/');
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join('/');
            try { await this.plugin.app.vault.createFolder(dir); } catch { /* already exists */ }
          }
          file = await this.plugin.app.vault.create(targetPath, noteContent);
        } else {
          const existing = await this.plugin.app.vault.read(file);
          await this.plugin.app.vault.modify(file, existing + '\n\n' + noteContent);
        }
        this.plugin.settings.lonelogSessionNotePath = targetPath;
        await this.plugin.saveSettings();
        this.plugin.app.workspace.getLeaf(false).openFile(file);
        new Notice(`Session log started: ${targetPath}`);
      } catch (e) {
        new Notice('Loner 4e: ' + (e as Error).message);
      }

      this.close();
    });
  }

  onClose(): void { this.contentEl.empty(); }
}
