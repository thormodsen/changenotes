import { writeFile } from 'node:fs/promises';
import type { Release } from './release-extractor.js';

const DEFAULT_FILENAME = 'releases.html';

export class ReportWriter {
  private filepath: string;
  private workspace: string;
  private channelId: string;

  constructor(workspace: string, channelId: string, filepath: string = DEFAULT_FILENAME) {
    this.filepath = filepath;
    this.workspace = workspace;
    this.channelId = channelId;
  }

  async writeReleases(releases: Release[]): Promise<void> {
    if (releases.length === 0) {
      return;
    }

    const content = this.formatHtml(releases);
    await writeFile(this.filepath, content, 'utf-8');
  }

  private buildSlackUrl(messageId: string): string {
    const timestamp = messageId.replace('.', '');
    return `https://${this.workspace}.slack.com/archives/${this.channelId}/p${timestamp}`;
  }

  private formatHtml(releases: Release[]): string {
    const items = releases
      .map((r) => {
        const url = this.buildSlackUrl(r.sourceMessageId);
        return `    <article>
      <h2>${r.date} - ${this.escapeHtml(r.title)}</h2>
      <p>${this.escapeHtml(r.description)}</p>
      <a href="${url}" target="_blank">View in Slack</a>
    </article>`;
      })
      .join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Releases</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    article { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    h2 { margin-bottom: 0.5rem; }
    p { color: #444; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Releases</h1>
${items}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
