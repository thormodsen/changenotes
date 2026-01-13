#!/usr/bin/env node

import { loadConfig } from './config.js';
import { SlackClient } from './slack-client.js';
import { StateManager } from './state-manager.js';
import { ReleaseExtractor } from './release-extractor.js';
import { ReportWriter } from './report-writer.js';

interface CliOptions {
  help: boolean;
  verbose: boolean;
}

function parseArgs(args: string[]): CliOptions {
  return {
    help: args.includes('--help') || args.includes('-h'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function printHelp(): void {
  console.log(`
slack-release-monitor - Extract release info from Slack and maintain a changelog

USAGE:
  slack-release-monitor [OPTIONS]

OPTIONS:
  --help, -h      Print this help message
  --verbose, -v   Enable debug logging to stderr

ENVIRONMENT VARIABLES:
  SLACK_TOKEN       Slack Bot OAuth token
  ANTHROPIC_API_KEY Anthropic API key
  SLACK_CHANNEL_ID  Slack channel ID to monitor

BEHAVIOR:
  Fetches messages from the configured Slack channel, filters out already-
  processed messages, uses Claude to extract release information, and
  appends new releases to releases.md.
`.trim());
}

function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(`[DEBUG] ${message}`);
  }
}

async function run(options: CliOptions): Promise<void> {
  log('Loading configuration...', options.verbose);
  const config = loadConfig();

  log('Initializing Slack client...', options.verbose);
  const slackClient = new SlackClient(config.slackToken, config.slackChannelId);

  log('Loading state...', options.verbose);
  const stateManager = new StateManager();
  await stateManager.load();

  log('Fetching messages from Slack...', options.verbose);
  const allMessages = await slackClient.fetchMessages();
  log(`Fetched ${allMessages.length} messages`, options.verbose);

  const unprocessedMessages = stateManager.getUnprocessedMessages(allMessages);
  log(`${unprocessedMessages.length} unprocessed messages`, options.verbose);

  if (unprocessedMessages.length === 0) {
    log('No new messages to process', options.verbose);
    return;
  }

  log('Extracting releases with Claude...', options.verbose);
  const extractor = new ReleaseExtractor(config.anthropicApiKey);
  const releases = await extractor.extractReleases(unprocessedMessages);
  log(`Extracted ${releases.length} releases`, options.verbose);

  if (releases.length > 0) {
    log('Writing releases to markdown...', options.verbose);
    const writer = new ReportWriter();
    await writer.appendReleases(releases);
  }

  log('Updating state...', options.verbose);
  await stateManager.markProcessed(unprocessedMessages.map((m) => m.id));

  log('Done!', options.verbose);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  try {
    await run(options);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
