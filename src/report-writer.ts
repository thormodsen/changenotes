import { readFile, writeFile, access } from 'node:fs/promises';
import type { Release } from './release-extractor.js';

const DEFAULT_FILENAME = 'releases.md';

export class ReportWriter {
  private filepath: string;

  constructor(filepath: string = DEFAULT_FILENAME) {
    this.filepath = filepath;
  }

  async appendReleases(releases: Release[]): Promise<void> {
    if (releases.length === 0) {
      return;
    }

    const existingContent = await this.readExistingContent();
    const newEntries = this.formatReleases(releases);
    const content = existingContent
      ? `${existingContent}\n\n${newEntries}`
      : newEntries;

    await writeFile(this.filepath, content, 'utf-8');
  }

  private async readExistingContent(): Promise<string> {
    try {
      await access(this.filepath);
      const content = await readFile(this.filepath, 'utf-8');
      return content.trim();
    } catch {
      return '';
    }
  }

  private formatReleases(releases: Release[]): string {
    return releases
      .map((r) => `## ${r.date} - ${r.title}\n\n${r.description}`)
      .join('\n\n');
  }
}
