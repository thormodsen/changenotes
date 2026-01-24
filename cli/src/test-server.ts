#!/usr/bin/env node

import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { SlackClient } from './slack-client.js';
import type { Release } from './release-extractor.js';
import { jsonrepair } from 'jsonrepair';

interface TestRequest {
  prompt: string;
  startDate: string;
  days: number;
}

function calculateTimeWindow(start: string, days: number): { oldest?: number; latest?: number } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const oldest = new Date(start).getTime();
  const latest = oldest + days * msPerDay;
  return { oldest, latest };
}

// Helper functions for test extraction
function formatMessage(message: any): string {
  const date = new Date(parseFloat(message.timestamp) * 1000).toISOString().split('T')[0];
  let messageText = `[${message.id}] [${date}] ${message.text}`;

  if (message.threadReplies && message.threadReplies.length > 0) {
    const threadText = message.threadReplies
      .map((reply: any) => {
        const replyDate = new Date(parseFloat(reply.timestamp) * 1000).toISOString().split('T')[0];
        const replyAuthor = reply.username || `user-${reply.userId.substring(0, 8)}`;
        return `  └─ [${reply.id}] [${replyDate}] @${replyAuthor}: ${reply.text}`;
      })
      .join('\n');
    messageText += `\n  [Thread replies (${message.threadReplies.length}):]\n${threadText}`;
  }

  return messageText;
}

function parseReleasesFromResponse(textContent: string): { result: Release[]; error?: Error } {
  let jsonText = textContent.trim();

  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n');
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    jsonText = lines.join('\n').trim();
  }

  const tryParse = (input: string): Release[] | null => {
    try {
      const releases = JSON.parse(input) as Release[];
      return Array.isArray(releases) ? releases : [];
    } catch {
      return null;
    }
  };

  const parsed = tryParse(jsonText);
  if (parsed) {
    return { result: parsed };
  }

  let repaired: string | null = null;
  try {
    repaired = jsonrepair(jsonText);
  } catch (repairError) {
    // JSON repair failed, continue to error
  }

  if (repaired) {
    const repairedParsed = tryParse(repaired);
    if (repairedParsed) {
      return { result: repairedParsed };
    }
  }

  return {
    result: [],
    error: new Error('Failed to parse JSON from LLM response'),
  };
}

async function extractReleasesWithPrompt(
  messages: any[],
  prompt: string,
  apiKey: string,
  verbose: boolean
): Promise<Release[]> {
  if (messages.length === 0) {
    return [];
  }

  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  const model = 'anthropic/claude-sonnet-4';
  const maxTokens = 4096;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/thormodsen/changelog-creator',
    'X-Title': 'Slack Release Monitor Test',
  };

  const allReleases: Release[] = [];

  for (const [index, message] of messages.entries()) {
    const formattedMessage = formatMessage(message);
    const userContent = `${prompt}\n\nMessage to analyze:\n\n${formattedMessage}`;

    if (verbose) {
      console.error(`[DEBUG] Processing message ${message.id} (${index + 1}/${messages.length})`);
    }

    const requestBody = {
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user' as const,
          content: userContent,
        },
      ],
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      if (verbose) {
        console.error(`[DEBUG] No content in LLM response`);
      }
      continue;
    }

    const parsed = parseReleasesFromResponse(textContent);

    if (parsed.error) {
      throw parsed.error;
    }

    allReleases.push(...parsed.result);
  }

  return allReleases;
}

async function handleRequest(req: any, res: any): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (req.url !== '/test') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const request: TestRequest = JSON.parse(body);

      if (!request.prompt || !request.startDate || !request.days) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: prompt, startDate, days' }));
        return;
      }

      console.error(`[TEST] Starting extraction with date: ${request.startDate}, days: ${request.days}`);

      const config = loadConfig();
      const slackClient = new SlackClient(config.slackToken, config.slackChannelId, true);
      const { oldest, latest } = calculateTimeWindow(request.startDate, request.days);

      console.error(`[TEST] Fetching messages from ${new Date(oldest).toISOString()} to ${new Date(latest).toISOString()}`);

      const messages = await slackClient.fetchMessages(oldest, latest);
      console.error(`[TEST] Fetched ${messages.length} messages`);

      if (messages.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          releases: [],
          messageCount: 0,
          message: 'No messages found for the specified date range',
        }));
        return;
      }

      const releases = await extractReleasesWithPrompt(messages, request.prompt, config.openRouterApiKey, true);

      console.error(`[TEST] Extracted ${releases.length} releases`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        releases,
        messageCount: messages.length,
        message: `Successfully processed ${messages.length} message(s) and extracted ${releases.length} release(s)`,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TEST] Error: ${message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });
}

const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3001;

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.error(`Test server running on http://localhost:${PORT}`);
  console.error(`Open test-rig.html in your browser to use the test interface`);
});
