import { MarkdownPostProcessorContext, Notice } from 'obsidian';
import type LonerPlugin from '../main';
import type { ChallengeTrack, StatusTrack } from '../main';

// ─── Default Status Tags ──────────────────────────────────────────────────────

export const DEFAULT_STATUS_TAGS: Record<StatusTrack['type'], [string, string, string]> = {
  physical:      ['Hurt', 'Injured', 'Overcome'],
  social:        ['Rattled', 'On the Back Foot', 'Humiliated'],
  psychological: ['Unsettled', 'Shaken', 'Broken'],
};

// ─── UUID helper ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Challenge Track Section (Sidebar) ───────────────────────────────────────

export function renderChallengeTrackSection(container: HTMLElement, plugin: LonerPlugin): void {
  const details = container.createEl('details', { cls: 'loner-section' });
  details.setAttribute('open', '');
  details.createEl('summary', { text: 'Challenge Tracks', cls: 'loner-section-title' });
  const section = details.createDiv({ cls: 'loner-section-content' });

  plugin.protagonistSheet.getChallengeTracks()
    .then(tracks => renderChallengeList(section, plugin, tracks))
    .catch(e => section.createEl('p', { text: (e as Error).message, cls: 'loner-error' }));
}

function renderChallengeList(section: HTMLElement, plugin: LonerPlugin, tracks: ChallengeTrack[]): void {
  section.empty();

  for (const track of tracks) {
    renderChallengeTrackRow(section, plugin, track);
  }

  // New Track button
  let formOpen = false;
  const newTrackBtn = section.createEl('button', { text: '+ New Track', cls: 'loner-btn loner-btn--add' });
  const form = section.createDiv({ cls: 'loner-track-form' });
  form.style.display = 'none';

  newTrackBtn.addEventListener('click', () => {
    if (formOpen) return;
    formOpen = true;
    form.style.display = 'block';

    const labelRow = form.createDiv({ cls: 'loner-field-row' });
    labelRow.createEl('label', { text: 'Label:', cls: 'loner-field-label' });
    const labelInput = labelRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'Track name…' });

    const reversedRow = form.createDiv({ cls: 'loner-field-row' });
    const reversedLabel = reversedRow.createEl('label');
    const reversedCheckbox = reversedLabel.createEl('input', { type: 'checkbox' });
    reversedLabel.appendText(' Threat track (reversed)');

    const createBtn = form.createEl('button', { text: 'Create', cls: 'loner-btn loner-btn--primary' });
    const cancelBtn = form.createEl('button', { text: 'Cancel', cls: 'loner-btn' });

    createBtn.addEventListener('click', async () => {
      const label = labelInput.value.trim();
      if (!label) return;
      const track: ChallengeTrack = {
        id: uid(),
        label,
        boxes: [false, false, false, false],
        reversed: reversedCheckbox.checked,
      };
      try {
        await plugin.protagonistSheet.addChallengeTrack(track);
        const updatedTracks = await plugin.protagonistSheet.getChallengeTracks();
        renderChallengeList(section, plugin, updatedTracks);
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    cancelBtn.addEventListener('click', () => {
      form.empty();
      form.style.display = 'none';
      formOpen = false;
    });
  });
}

function renderChallengeTrackRow(section: HTMLElement, plugin: LonerPlugin, track: ChallengeTrack): void {
  const row = section.createDiv({ cls: 'loner-challenge-track' });

  // Label (editable)
  const labelInput = row.createEl('input', { type: 'text', cls: 'loner-track-label-input' });
  labelInput.value = track.label;
  labelInput.addEventListener('blur', async () => {
    if (labelInput.value.trim() === track.label) return;
    const tracks = await plugin.protagonistSheet.getChallengeTracks();
    const idx = tracks.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      tracks[idx].label = labelInput.value.trim();
      await plugin.protagonistSheet.write({ challenge_tracks: tracks });
    }
  });

  if (track.reversed) {
    row.createEl('span', { text: '⚠ Threat', cls: 'loner-track-reversed-badge' });
  }

  // Boxes
  const boxesRow = row.createDiv({ cls: 'loner-track-boxes' });
  const currentBoxes = [...track.boxes] as [boolean, boolean, boolean, boolean];
  const isComplete = currentBoxes.every(Boolean);

  for (let i = 0; i < 4; i++) {
    const box = boxesRow.createEl('span', { cls: 'loner-track-box' });
    if (currentBoxes[i]) box.addClass('loner-track-box--filled');
    box.title = 'Update only if this challenge was the scene\'s stated focus when framed.';
    box.addEventListener('click', async () => {
      currentBoxes[i] = !currentBoxes[i];
      box.toggleClass('loner-track-box--filled', currentBoxes[i]);
      checkCompletion();
      try {
        await plugin.protagonistSheet.updateChallengeTrack(track.id, [...currentBoxes]);
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });
  }

  const completionEl = row.createEl('span', { cls: 'loner-track-completion' });
  const checkCompletion = (): void => {
    const complete = currentBoxes.every(Boolean);
    completionEl.setText(complete ? 'Challenge resolved.' : '');
    completionEl.toggleClass('loner-track-complete', complete);
  };
  if (isComplete) checkCompletion();

  // Log to note (Lonelog)
  if (plugin.settings.useLonelog) {
    const logBtn = row.createEl('button', { text: 'Log', cls: 'loner-btn loner-btn--icon' });
    logBtn.createSpan({ cls: 'loner-lonelog-badge', text: 'LL' });
    logBtn.addEventListener('click', async () => {
      const content = plugin.lonelogFormatter.formatChallengeTrackState(track);
      await plugin.insertIntoActiveNote(content);
    });
  }

  // Close Track
  const closeBtn = row.createEl('button', { text: 'Close Track', cls: 'loner-btn loner-btn--danger' });
  closeBtn.addEventListener('click', async () => {
    try {
      await plugin.protagonistSheet.removeChallengeTrack(track.id);
      row.remove();
    } catch (e) {
      new Notice('Loner Assistant: ' + (e as Error).message);
    }
  });
}

// ─── Challenge Track Code Block ───────────────────────────────────────────────

export async function renderChallengeTrackBlock(
  source: string,
  el: HTMLElement,
  _ctx: MarkdownPostProcessorContext,
  plugin: LonerPlugin
): Promise<void> {
  el.empty();
  const trackId = source.replace(/track-id:\s*/i, '').trim();

  let tracks: ChallengeTrack[];
  try {
    tracks = await plugin.protagonistSheet.getChallengeTracks();
  } catch (e) {
    el.createEl('p', { text: 'Loner Assistant: ' + (e as Error).message, cls: 'loner-error' });
    return;
  }

  const track = tracks.find(t => t.id === trackId);
  if (!track) {
    el.createEl('p', { text: `Challenge track "${trackId}" not found in protagonist note.`, cls: 'loner-error' });
    return;
  }

  renderInlineTrack(el, plugin, track, 'challenge');
}

// ─── Status Track Section (Sidebar) ──────────────────────────────────────────

export function renderStatusTrackSection(container: HTMLElement, plugin: LonerPlugin): void {
  const details = container.createEl('details', { cls: 'loner-section' });
  details.setAttribute('open', '');
  details.createEl('summary', { text: 'Status Tracks', cls: 'loner-section-title' });
  const section = details.createDiv({ cls: 'loner-section-content' });

  plugin.protagonistSheet.getStatusTracks()
    .then(tracks => renderStatusList(section, plugin, tracks))
    .catch(e => section.createEl('p', { text: (e as Error).message, cls: 'loner-error' }));
}

function renderStatusList(section: HTMLElement, plugin: LonerPlugin, tracks: StatusTrack[]): void {
  section.empty();

  for (const track of tracks) {
    renderStatusTrackRow(section, plugin, track);
  }

  // New Status Track button
  let formOpen = false;
  const newBtn = section.createEl('button', { text: '+ New Status Track', cls: 'loner-btn loner-btn--add' });
  const form = section.createDiv({ cls: 'loner-track-form' });
  form.style.display = 'none';

  newBtn.addEventListener('click', () => {
    if (formOpen) return;
    formOpen = true;
    form.style.display = 'block';

    const labelRow = form.createDiv({ cls: 'loner-field-row' });
    labelRow.createEl('label', { text: 'Label:', cls: 'loner-field-label' });
    const labelInput = labelRow.createEl('input', { type: 'text', cls: 'loner-field-input', placeholder: 'Physical, Social, etc.' });

    const typeRow = form.createDiv({ cls: 'loner-field-row' });
    typeRow.createEl('label', { text: 'Type:', cls: 'loner-field-label' });
    const typeSelect = typeRow.createEl('select', { cls: 'loner-field-select' });
    (['physical', 'social', 'psychological'] as const).forEach(t => {
      typeSelect.createEl('option', { value: t, text: t.charAt(0).toUpperCase() + t.slice(1) });
    });

    const createBtn = form.createEl('button', { text: 'Create', cls: 'loner-btn loner-btn--primary' });
    const cancelBtn = form.createEl('button', { text: 'Cancel', cls: 'loner-btn' });

    createBtn.addEventListener('click', async () => {
      const label = labelInput.value.trim();
      if (!label) return;
      const type = typeSelect.value as StatusTrack['type'];
      const track: StatusTrack = {
        id: uid(),
        label,
        type,
        boxes: [false, false, false],
        tags: [...DEFAULT_STATUS_TAGS[type]],
      };
      try {
        await plugin.protagonistSheet.addStatusTrack(track);
        const updated = await plugin.protagonistSheet.getStatusTracks();
        renderStatusList(section, plugin, updated);
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });

    cancelBtn.addEventListener('click', () => {
      form.empty();
      form.style.display = 'none';
      formOpen = false;
    });
  });
}

function renderStatusTrackRow(section: HTMLElement, plugin: LonerPlugin, track: StatusTrack): void {
  const row = section.createDiv({ cls: 'loner-status-track' });

  row.createEl('div', {
    text: `${track.label} (${track.type})`,
    cls: 'loner-status-track-header',
  });

  const boxesRow = row.createDiv({ cls: 'loner-track-boxes' });
  const currentBoxes = [...track.boxes] as [boolean, boolean, boolean];

  for (let i = 0; i < 3; i++) {
    const box = boxesRow.createEl('span', { cls: 'loner-track-box' });
    if (currentBoxes[i]) box.addClass('loner-track-box--filled');

    const tagLabel = boxesRow.createEl('span', { cls: 'loner-status-tag-label' });
    if (currentBoxes[i]) tagLabel.setText(track.tags[i]);

    box.addEventListener('click', async () => {
      currentBoxes[i] = !currentBoxes[i];
      box.toggleClass('loner-track-box--filled', currentBoxes[i]);
      tagLabel.setText(currentBoxes[i] ? track.tags[i] : '');
      checkOvercome();
      try {
        await plugin.protagonistSheet.updateStatusTrack(track.id, [...currentBoxes]);
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });
  }

  const overcomeEl = row.createEl('span', { cls: 'loner-status-overcome' });
  const checkOvercome = (): void => {
    overcomeEl.setText(currentBoxes[2] ? 'Character is overcome.' : '');
  };
  if (currentBoxes[2]) checkOvercome();

  // Clear Box
  const clearBtn = row.createEl('button', { text: 'Clear Box', cls: 'loner-btn' });
  clearBtn.title = 'Recovery requires fictional justification: rest, treatment, or a recovery scene.';
  clearBtn.addEventListener('click', async () => {
    const lastFilled = currentBoxes.lastIndexOf(true);
    if (lastFilled === -1) return;
    currentBoxes[lastFilled] = false;
    try {
      await plugin.protagonistSheet.updateStatusTrack(track.id, [...currentBoxes]);
      plugin.refreshProtagonistView();
    } catch (e) {
      new Notice('Loner Assistant: ' + (e as Error).message);
    }
  });

  // Log to note (Lonelog)
  if (plugin.settings.useLonelog) {
    const logBtn = row.createEl('button', { text: 'Log', cls: 'loner-btn loner-btn--icon' });
    logBtn.createSpan({ cls: 'loner-lonelog-badge', text: 'LL' });
    logBtn.addEventListener('click', async () => {
      const content = plugin.lonelogFormatter.formatStatusTrackState(track);
      await plugin.insertIntoActiveNote(content);
    });
  }

  // Close Track
  const closeBtn = row.createEl('button', { text: 'Close Track', cls: 'loner-btn loner-btn--danger' });
  closeBtn.addEventListener('click', async () => {
    try {
      await plugin.protagonistSheet.removeStatusTrack(track.id);
      row.remove();
    } catch (e) {
      new Notice('Loner Assistant: ' + (e as Error).message);
    }
  });
}

// ─── Status Track Code Block ──────────────────────────────────────────────────

export async function renderStatusTrackBlock(
  source: string,
  el: HTMLElement,
  _ctx: MarkdownPostProcessorContext,
  plugin: LonerPlugin
): Promise<void> {
  el.empty();
  const trackId = source.replace(/track-id:\s*/i, '').trim();

  let tracks: StatusTrack[];
  try {
    tracks = await plugin.protagonistSheet.getStatusTracks();
  } catch (e) {
    el.createEl('p', { text: 'Loner Assistant: ' + (e as Error).message, cls: 'loner-error' });
    return;
  }

  const track = tracks.find(t => t.id === trackId);
  if (!track) {
    el.createEl('p', { text: `Status track "${trackId}" not found in protagonist note.`, cls: 'loner-error' });
    return;
  }

  renderInlineTrack(el, plugin, track, 'status');
}

// ─── Shared Inline Track Renderer ────────────────────────────────────────────

function renderInlineTrack(
  el: HTMLElement,
  plugin: LonerPlugin,
  track: ChallengeTrack | StatusTrack,
  type: 'challenge' | 'status'
): void {
  const widget = el.createDiv({ cls: 'loner-inline-track' });
  widget.createEl('span', { text: track.label, cls: 'loner-track-label' });

  const boxCount = type === 'challenge' ? 4 : 3;
  const currentBoxes = [...track.boxes] as boolean[];

  for (let i = 0; i < boxCount; i++) {
    const box = widget.createEl('span', { cls: 'loner-track-box' });
    if (currentBoxes[i]) box.addClass('loner-track-box--filled');
    box.addEventListener('click', async () => {
      currentBoxes[i] = !currentBoxes[i];
      box.toggleClass('loner-track-box--filled', currentBoxes[i]);
      try {
        if (type === 'challenge') {
          await plugin.protagonistSheet.updateChallengeTrack(track.id, [...currentBoxes]);
        } else {
          await plugin.protagonistSheet.updateStatusTrack(track.id, [...currentBoxes]);
        }
        plugin.refreshProtagonistView();
      } catch (e) {
        new Notice('Loner Assistant: ' + (e as Error).message);
      }
    });
  }
}
