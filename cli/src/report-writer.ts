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

  async writeReleasesFromStore(store: { getAllReleases(): Promise<Release[]> }): Promise<void> {
    const releases = await store.getAllReleases();
    await this.writeReleases(releases);
  }

  private buildSlackUrl(messageId: string): string {
    const timestamp = messageId.replace('.', '');
    return `https://${this.workspace}.slack.com/archives/${this.channelId}/p${timestamp}`;
  }

  private formatHtml(releases: Release[]): string {
    // Group releases by date
    const releasesByDate = new Map<string, Release[]>();
    for (const release of releases) {
      const date = release.date;
      if (!releasesByDate.has(date)) {
        releasesByDate.set(date, []);
      }
      releasesByDate.get(date)!.push(release);
    }

    // Format date for display (e.g., "December 5, 2025")
    const formatDisplayDate = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Extract platform info from title
    const extractPlatforms = (title: string): string[] => {
      const platforms: string[] = [];
      if (/iOS|ios|iPhone|iPad/i.test(title)) platforms.push('iOS');
      if (/Android|android/i.test(title)) platforms.push('Android');
      if (/Web|web|WebApp/i.test(title)) platforms.push('Web');
      return platforms;
    };

            // Use type from release data (determined by LLM)
    const getFeatureType = (release: Release): string => {
      return release.type || 'Update';
    };

    // Determine if this is a "New Feature" type for special styling
    const isNewFeature = (type: string): boolean => {
      return type.toLowerCase().includes('new feature') || type.toLowerCase() === 'newfeature';
    };

    const sections = Array.from(releasesByDate.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, dateReleases]) => {
        const displayDate = formatDisplayDate(date);
        const items = dateReleases
          .map((r) => {
            const url = this.buildSlackUrl(r.sourceMessageId);
            const platforms = extractPlatforms(r.title);
            const featureType = getFeatureType(r);
            const platformTag = platforms.length > 0 ? platforms.join(' · ') : null;

            // Build detail boxes for Why This Matters and Impact
            const detailBoxes: string[] = [];
            if (r.whyThisMatters) {
              detailBoxes.push(`          <div class="detail-box">
            <div class="detail-box-title">Why This Matters</div>
            <p class="detail-box-content">${this.escapeHtml(r.whyThisMatters)}</p>
          </div>`);
            }
            if (r.impact) {
              detailBoxes.push(`          <div class="detail-box">
            <div class="detail-box-title">Impact</div>
            <p class="detail-box-content">${this.escapeHtml(r.impact)}</p>
          </div>`);
            }

            const detailBoxesSection = detailBoxes.length > 0
              ? `        <div class="detail-boxes">
${detailBoxes.join('\n')}
        </div>`
              : '';

            return `      <div class="release-card">
        <div class="card-header">
          <h3 class="card-title">
            <a href="${url}" target="_blank" class="title-link">
              ${this.escapeHtml(r.title)}
              <svg class="external-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 3H9.5V1.5H12.5V4.5H11V3Z" fill="currentColor"/>
                <path d="M3 3H7V4.5H4.5V9.5H9.5V7H11V11H3V3Z" fill="currentColor"/>
              </svg>
            </a>
          </h3>
          <div class="card-tags">
            <span class="tag ${isNewFeature(featureType) ? 'tag-type tag-new-feature' : 'tag-type'}">${this.escapeHtml(featureType)}</span>
            ${platformTag ? `<span class="tag tag-platform">${this.escapeHtml(platformTag)}</span>` : ''}
          </div>
        </div>
        <p class="card-description">${this.escapeHtml(r.description)}</p>
${detailBoxesSection}
        <a href="${url}" target="_blank" class="read-more-link">Read more</a>
      </div>`;
          })
          .join('\n\n');

        return `    <div class="date-section">
      <span class="date-text">${displayDate}</span>
      <div class="releases-container">
${items}
      </div>
    </div>`;
      })
      .join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Releases</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background-color: #F5F5F5;
      min-height: 100vh;
      padding: 2rem 1rem;
      line-height: 1.6;
    }

    .main-container {
      max-width: 900px;
      margin: 0 auto;
    }

    .date-section {
      margin-bottom: 2.5rem;
    }

    .date-section:last-child {
      margin-bottom: 0;
    }

    .date-text {
      color: #333333;
      font-size: 1rem;
      font-weight: 500;
      margin-bottom: 1rem;
      display: block;
    }

    .releases-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .release-card {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: box-shadow 0.2s ease;
    }

    .release-card:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .card-title {
      flex: 1;
      min-width: 200px;
    }

    .title-link {
      color: #2A2A2A;
      text-decoration: none;
      font-size: 1.25rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: opacity 0.2s ease;
    }

    .title-link:hover {
      opacity: 0.7;
    }

    .external-icon {
      color: #2A2A2A;
      flex-shrink: 0;
      opacity: 0.5;
    }

    .card-tags {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .tag {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .tag-type {
      background-color: #E0E0E0;
      color: #2A2A2A;
    }

    .tag-type.tag-new-feature {
      background-color: #C8FF2C;
      color: #2A2A2A;
    }

    .tag-platform {
      background-color: #E0E0E0;
      color: #2A2A2A;
    }

    .card-description {
      color: #333333;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .read-more-link {
      color: #007bff;
      text-decoration: none;
      font-size: 0.95rem;
      display: inline-block;
      margin-top: 0.5rem;
    }

    .read-more-link:hover {
      text-decoration: underline;
    }

    .detail-boxes {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .detail-boxes:has(.detail-box:nth-child(2)) {
      grid-template-columns: 1fr 1fr;
    }

    .detail-box {
      background-color: #F0F4F8;
      border-radius: 8px;
      padding: 1rem;
    }

    .detail-box-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: #2A2A2A;
      margin-bottom: 0.5rem;
    }

    .detail-box-content {
      color: #333333;
      font-size: 0.9rem;
      line-height: 1.6;
      margin: 0;
    }

    @media (max-width: 768px) {
      body {
        padding: 1rem 0.5rem;
      }

      .card-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .card-title {
        width: 100%;
      }

      .title-link {
        font-size: 1.1rem;
      }

      .detail-boxes {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="main-container">
${sections}
  </div>
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
