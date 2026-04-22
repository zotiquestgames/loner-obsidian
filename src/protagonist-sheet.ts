import { App, TFile } from 'obsidian';
import type { LonerSettings, ProtagonistData, ChallengeTrack, StatusTrack } from '../main';

export class ProtagonistSheet {
  constructor(private app: App, private settings: LonerSettings) {}

  private getFile(): TFile {
    const path = this.settings.protagonistNotePath;
    if (!path) throw new Error('No Protagonist note configured. Set a path in Loner Assistant Settings.');
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`Protagonist note not found: "${path}"`);
    return file;
  }

  async read(): Promise<ProtagonistData> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) throw new Error(`No frontmatter found in "${file.path}". Add YAML frontmatter with loner_protagonist: true.`);

    return {
      loner_protagonist: fm.loner_protagonist ?? true,
      name: fm.name ?? '',
      concept: fm.concept ?? '',
      frailty: Array.isArray(fm.frailty) ? fm.frailty : (fm.frailty ? [String(fm.frailty)] : []),
      skill: Array.isArray(fm.skill) ? fm.skill : [],
      gear: Array.isArray(fm.gear) ? fm.gear : [],
      goal: fm.goal ?? '',
      motive: fm.motive ?? '',
      nemesis: fm.nemesis ?? '',
      luck: typeof fm.luck === 'number' ? fm.luck : 6,
      luck_max: typeof fm.luck_max === 'number' ? fm.luck_max : 6,
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      relationship_tags: Array.isArray(fm.relationship_tags) ? fm.relationship_tags : [],
      leverage: fm.leverage ?? null,
      twist_counter: typeof fm.twist_counter === 'number' ? fm.twist_counter : 0,
      challenge_tracks: Array.isArray(fm.challenge_tracks) ? fm.challenge_tracks : [],
      status_tracks: Array.isArray(fm.status_tracks) ? fm.status_tracks : [],
    };
  }

  async write(data: Partial<ProtagonistData>): Promise<void> {
    const file = this.getFile();
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      Object.assign(fm, data);
    });
  }

  async getTwistCounter(): Promise<number> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return typeof fm?.twist_counter === 'number' ? fm.twist_counter : 0;
  }

  async setTwistCounter(n: number): Promise<void> {
    await this.write({ twist_counter: n });
  }

  async getLuck(): Promise<number> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return typeof fm?.luck === 'number' ? fm.luck : 6;
  }

  async setLuck(n: number): Promise<void> {
    await this.write({ luck: Math.max(0, n) });
  }

  async getLeverage(): Promise<string | null> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm?.leverage ?? null;
  }

  async setLeverage(desc: string | null): Promise<void> {
    await this.write({ leverage: desc });
  }

  async getChallengeTracks(): Promise<ChallengeTrack[]> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return Array.isArray(fm?.challenge_tracks) ? fm.challenge_tracks : [];
  }

  async updateChallengeTrack(id: string, boxes: boolean[]): Promise<void> {
    const tracks = await this.getChallengeTracks();
    const idx = tracks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tracks[idx].boxes = boxes as [boolean, boolean, boolean, boolean];
    await this.write({ challenge_tracks: tracks });
  }

  async addChallengeTrack(track: ChallengeTrack): Promise<void> {
    const tracks = await this.getChallengeTracks();
    tracks.push(track);
    await this.write({ challenge_tracks: tracks });
  }

  async removeChallengeTrack(id: string): Promise<void> {
    const tracks = await this.getChallengeTracks();
    await this.write({ challenge_tracks: tracks.filter(t => t.id !== id) });
  }

  async getStatusTracks(): Promise<StatusTrack[]> {
    const file = this.getFile();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return Array.isArray(fm?.status_tracks) ? fm.status_tracks : [];
  }

  async updateStatusTrack(id: string, boxes: boolean[]): Promise<void> {
    const tracks = await this.getStatusTracks();
    const idx = tracks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tracks[idx].boxes = boxes as [boolean, boolean, boolean];
    await this.write({ status_tracks: tracks });
  }

  async addStatusTrack(track: StatusTrack): Promise<void> {
    const tracks = await this.getStatusTracks();
    tracks.push(track);
    await this.write({ status_tracks: tracks });
  }

  async removeStatusTrack(id: string): Promise<void> {
    const tracks = await this.getStatusTracks();
    await this.write({ status_tracks: tracks.filter(t => t.id !== id) });
  }
}
