import 'dotenv/config';

export interface Config {
  slackToken: string;
  openRouterApiKey: string;
  slackWorkspace: string;
  slackChannelId: string;
  langfuse?: {
    secretKey: string;
    publicKey: string;
    baseUrl: string;
  };
}

export function loadConfig(): Config {
  const values: Record<string, string | undefined> = {
    SLACK_TOKEN: process.env.SLACK_TOKEN,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SLACK_WORKSPACE: process.env.SLACK_WORKSPACE,
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

  const config: Config = {
    slackToken: values.SLACK_TOKEN as string,
    openRouterApiKey: values.OPENROUTER_API_KEY as string,
    slackWorkspace: values.SLACK_WORKSPACE as string,
    slackChannelId: values.SLACK_CHANNEL_ID as string,
  };

  // Langfuse is optional
  const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY;
  const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const langfuseBaseUrl = process.env.LANGFUSE_BASE_URL;

  if (langfuseSecretKey && langfusePublicKey && langfuseBaseUrl) {
    config.langfuse = {
      secretKey: langfuseSecretKey,
      publicKey: langfusePublicKey,
      baseUrl: langfuseBaseUrl,
    };
  }

  return config;
}
