import { WebClient } from '@slack/web-api';

export interface SlackMessage {
  id: string;
  text: string;
  timestamp: string;
  userId: string;
  username?: string;
  appId?: string;
  botId?: string;
  subtype?: string;
  threadReplies?: SlackMessage[];
}

export class SlackClient {
  private client: WebClient;
  private channelId: string;
  private verbose: boolean;
  private botInfoCache: Map<string, { name?: string }> = new Map();

  constructor(token: string, channelId: string, verbose: boolean = false) {
    this.client = new WebClient(token);
    this.channelId = channelId;
    this.verbose = verbose;
  }

  private async getBotInfo(botId: string): Promise<{ name?: string } | null> {
    if (this.botInfoCache.has(botId)) {
      return this.botInfoCache.get(botId)!;
    }

    try {
      const response = await this.client.bots.info({ bot: botId });
      if (response.ok && response.bot) {
        const botInfo = {
          name: response.bot.name,
        };
        this.botInfoCache.set(botId, botInfo);
        return botInfo;
      }
    } catch (error) {
      // If bot info lookup fails, cache null to avoid repeated lookups
      this.botInfoCache.set(botId, {});
    }
    return null;
  }

  private toSlackMessage(msg: {
    ts?: string;
    text?: string;
    user?: string;
    username?: string;
    app_id?: string;
    bot_id?: string;
    subtype?: string;
  }): SlackMessage | null {
    if (!msg.ts || !msg.text) {
      return null;
    }

    return {
      id: msg.ts,
      text: msg.text,
      timestamp: msg.ts,
      userId: msg.user ?? '',
      username: msg.username,
      appId: msg.app_id,
      botId: msg.bot_id,
      subtype: msg.subtype,
    };
  }

  private async fetchThreadMessages(
    channelId: string,
    threadTs: string
  ): Promise<{ parent: SlackMessage | null; replies: SlackMessage[] }> {
    let parent: SlackMessage | null = null;
    const replies: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      try {
        const response = await this.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
          cursor,
          limit: 100,
        });

        if (!response.ok) {
          if (this.verbose) {
            console.error(`[DEBUG] Failed to fetch thread messages for ${threadTs}: ${response.error}`);
          }
          break;
        }

        for (const msg of response.messages ?? []) {
          const normalized = this.toSlackMessage(msg);
          if (!normalized) {
            continue;
          }

          if (msg.ts === threadTs) {
            parent = normalized;
          } else {
            replies.push(normalized);
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } catch (error) {
        if (this.verbose) {
          console.error(`[DEBUG] Error fetching thread messages for ${threadTs}:`, error);
        }
        break;
      }
    } while (cursor);

    return { parent, replies };
  }

  async fetchMessages(oldest?: number, latest?: number): Promise<SlackMessage[]> {
    const messagesById = new Map<string, SlackMessage>();
    const threadsToHydrate = new Set<string>();
    let cursor: string | undefined;

    do {
      const response = await this.client.conversations.history({
        channel: this.channelId,
        cursor,
        limit: 200,
        oldest: oldest ? String(oldest / 1000) : undefined,
        latest: latest ? String(latest / 1000) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      for (const msg of response.messages ?? []) {
        if (msg.ts && msg.text) {
          // Filter out messages from bitrise or automated release notes
          const text = msg.text.toLowerCase();
          const username = msg.username?.toLowerCase() || '';
          const appId = msg.app_id || '';
          const botId = msg.bot_id || '';
          
          // Get bot name if bot_id is present
          let botName = '';
          if (botId) {
            const botInfo = await this.getBotInfo(botId);
            botName = botInfo?.name?.toLowerCase() || '';
          }
          
          // Known Automated Release Notes bot ID
          const isKnownAutomatedReleaseNotesBot = botId === 'B085LB91R52';
          
          // Check if message should be filtered
          const bitriseChecks = {
            username: username.includes('bitrise'),
            text: text.includes('bitrise'),
            appId: appId.includes('bitrise'),
            botId: botId.includes('bitrise'),
            botName: botName.includes('bitrise'),
          };
          const isBitrise = bitriseChecks.username || bitriseChecks.text || bitriseChecks.appId || bitriseChecks.botId || bitriseChecks.botName;
          
          const automatedReleaseNotesChecks = {
            usernameExact: username.includes('automated release notes'),
            usernameHyphen: username.includes('automated-release-notes'),
            text: text.includes('automated release notes'),
            appId: appId.includes('automated-release-notes'),
            botId: botId.includes('automated-release-notes'),
            botName: botName.includes('automated release notes') || botName.includes('automated-release-notes'),
            knownBotId: isKnownAutomatedReleaseNotesBot,
          };
          const isAutomatedReleaseNotes = automatedReleaseNotesChecks.usernameExact ||
                                         automatedReleaseNotesChecks.usernameHyphen ||
                                         automatedReleaseNotesChecks.text ||
                                         automatedReleaseNotesChecks.appId ||
                                         automatedReleaseNotesChecks.botId ||
                                         automatedReleaseNotesChecks.botName ||
                                         automatedReleaseNotesChecks.knownBotId;
          
          if (isBitrise || isAutomatedReleaseNotes) {
            // Only log filtered messages in verbose mode
            if (this.verbose) {
              console.error(`[FILTERED] Message ${msg.ts}:`);
              console.error(`  username: "${msg.username || '(none)'}"`);
              console.error(`  app_id: "${appId || '(none)'}"`);
              console.error(`  bot_id: "${botId || '(none)'}"`);
              console.error(`  bot_name: "${botName || '(none)'}"`);
              console.error(`  text (first 100 chars): "${msg.text.substring(0, 100)}"`);
              if (isBitrise) {
                console.error(`  Bitrise checks:`, bitriseChecks, `-> FILTERED (Bitrise)`);
              }
              if (isAutomatedReleaseNotes) {
                console.error(`  Automated Release Notes checks:`, automatedReleaseNotesChecks, `-> FILTERED (Automated Release Notes)`);
              }
            }
            continue;
          }

          if (msg.thread_ts && msg.thread_ts !== msg.ts) {
            threadsToHydrate.add(msg.thread_ts);
            continue;
          }

          if (msg.reply_count && msg.reply_count > 0) {
            threadsToHydrate.add(msg.ts);
          }

          const normalized = this.toSlackMessage(msg);
          if (normalized) {
            messagesById.set(normalized.id, normalized);
          }
        }
      }

      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    for (const threadTs of threadsToHydrate) {
      if (this.verbose) {
        console.error(`[DEBUG] Fetching thread messages for ${threadTs}`);
      }
      const { parent, replies } = await this.fetchThreadMessages(this.channelId, threadTs);
      if (!parent) {
        if (this.verbose) {
          console.error(`[DEBUG] Thread ${threadTs} missing parent message`);
        }
        continue;
      }

      const existing = messagesById.get(parent.id);
      const replyMap = new Map<string, SlackMessage>();
      for (const reply of replies) {
        replyMap.set(reply.id, reply);
      }
      if (existing?.threadReplies) {
        for (const reply of existing.threadReplies) {
          replyMap.set(reply.id, reply);
        }
      }

      const merged = existing ?? parent;
      merged.threadReplies = Array.from(replyMap.values()).sort((a, b) => {
        return parseFloat(a.timestamp) - parseFloat(b.timestamp);
      });
      messagesById.set(merged.id, merged);

      if (this.verbose && merged.threadReplies.length > 0) {
        console.error(`[DEBUG] Fetched ${merged.threadReplies.length} thread replies for message ${merged.id}`);
      }
    }

    return Array.from(messagesById.values());
  }
}
