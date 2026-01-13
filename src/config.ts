import 'dotenv/config';

export interface Config {
  slackToken: string;
  anthropicApiKey: string;
  slackChannelId: string;
}

export function loadConfig(): Config {
  const values: Record<string, string | undefined> = {
    SLACK_TOKEN: process.env.SLACK_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\nCreate a .env file or set these in your environment.`
    );
  }

  return {
    slackToken: values.SLACK_TOKEN as string,
    anthropicApiKey: values.ANTHROPIC_API_KEY as string,
    slackChannelId: values.SLACK_CHANNEL_ID as string,
  };
}
