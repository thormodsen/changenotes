import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Release } from './release-extractor.js';

const STORE_FILE = 'releases.json';

export interface StoredRelease extends Release {
  createdAt: string;
  updatedAt: string;
}

export class ReleasesStore {
  private storePath: string;

  constructor(cwd: string = process.cwd()) {
    this.storePath = `${cwd}/${STORE_FILE}`;
  }

  async load(): Promise<StoredRelease[]> {
    if (!existsSync(this.storePath)) {
      return [];
    }

    const content = await readFile(this.storePath, 'utf-8');
    const releases = JSON.parse(content) as StoredRelease[];
    return Array.isArray(releases) ? releases : [];
  }

  async save(releases: StoredRelease[]): Promise<void> {
    await writeFile(this.storePath, JSON.stringify(releases, null, 2), 'utf-8');
  }

  async addReleases(newReleases: Release[]): Promise<{ added: number; skipped: number }> {
    const existing = await this.load();
    const existingIds = new Set(existing.map((r) => r.sourceMessageId));
    const now = new Date().toISOString();

    let added = 0;
    let skipped = 0;

    for (const release of newReleases) {
      if (existingIds.has(release.sourceMessageId)) {
        skipped++;
        continue;
      }

      const stored: StoredRelease = {
        ...release,
        createdAt: now,
        updatedAt: now,
      };
      existing.push(stored);
      existingIds.add(release.sourceMessageId);
      added++;
    }

    if (added > 0) {
      await this.save(existing);
    }

    return { added, skipped };
  }

  async getAllReleases(): Promise<StoredRelease[]> {
    return this.load();
  }

  async getReleasesByDateRange(start?: string, end?: string): Promise<StoredRelease[]> {
    const all = await this.load();
    return all.filter((r) => {
      if (start && r.date < start) return false;
      if (end && r.date > end) return false;
      return true;
    });
  }
}
