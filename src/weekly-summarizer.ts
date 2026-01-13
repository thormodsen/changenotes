import { readFile, writeFile, access } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';

interface ParsedRelease {
  date: string;
  title: string;
  description: string;
}

const SUMMARY_PROMPT = `You are summarizing a week of software releases for a team digest.

Given the following releases, create a concise summary that includes:
1. Key Highlights: The most significant releases or changes (2-4 bullet points)
2. Common Themes: Patterns or areas of focus this week
3. Total Release Count: The number of releases

Keep the tone professional but readable. Use markdown formatting.

Only output the summary, nothing else.`;

export class WeeklySummarizer {
  private client: Anthropic;
  private releasesPath: string;

  constructor(apiKey: string, releasesPath: string = 'releases.md') {
    this.client = new Anthropic({ apiKey });
    this.releasesPath = releasesPath;
  }

  async generateWeeklySummary(): Promise<string> {
    const releases = await this.parseRecentReleases();
    const outputPath = this.getOutputPath();

    if (releases.length === 0) {
      await writeFile(outputPath, this.formatEmptySummary(), 'utf-8');
      return outputPath;
    }

    const summary = await this.summarizeWithClaude(releases);
    await writeFile(outputPath, summary, 'utf-8');

    return outputPath;
  }

  private async parseRecentReleases(): Promise<ParsedRelease[]> {
    const content = await this.readReleasesFile();
    if (!content) {
      return [];
    }

    const releases = this.parseMarkdown(content);
    const sevenDaysAgo = this.getSevenDaysAgo();

    return releases.filter((r) => r.date >= sevenDaysAgo);
  }

  private async readReleasesFile(): Promise<string> {
    try {
      await access(this.releasesPath);
      return await readFile(this.releasesPath, 'utf-8');
    } catch {
      return '';
    }
  }

  private parseMarkdown(content: string): ParsedRelease[] {
    const releases: ParsedRelease[] = [];
    const entryPattern = /^## (\d{4}-\d{2}-\d{2}) - (.+)$/gm;
    const entries = content.split(/(?=^## \d{4}-\d{2}-\d{2})/m).filter(Boolean);

    for (const entry of entries) {
      const match = entryPattern.exec(entry);
      entryPattern.lastIndex = 0;

      if (match) {
        const [, date, title] = match;
        const descriptionStart = entry.indexOf('\n\n');
        const description =
          descriptionStart !== -1
            ? entry.slice(descriptionStart + 2).trim()
            : '';

        releases.push({ date, title, description });
      }
    }

    return releases;
  }

  private getSevenDaysAgo(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  private getOutputPath(): string {
    const today = new Date().toISOString().split('T')[0];
    return `weekly-summary-${today}.md`;
  }

  private formatEmptySummary(): string {
    return '# Weekly Summary\n\nNo releases found in the last 7 days.';
  }

  private async summarizeWithClaude(
    releases: ParsedRelease[]
  ): Promise<string> {
    const formattedReleases = releases
      .map((r) => `## ${r.date} - ${r.title}\n\n${r.description}`)
      .join('\n\n');

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `${SUMMARY_PROMPT}\n\nReleases from the last 7 days:\n\n${formattedReleases}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return this.formatEmptySummary();
    }

    return `# Weekly Summary\n\n${textContent.text}`;
  }
}
