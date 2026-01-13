import { Langfuse } from 'langfuse';
import type { Config } from './config.js';

export class LangfuseClient {
  private client: Langfuse | null = null;
  private enabled: boolean;

  constructor(config: Config) {
    if (config.langfuse) {
      this.client = new Langfuse({
        secretKey: config.langfuse.secretKey,
        publicKey: config.langfuse.publicKey,
        baseUrl: config.langfuse.baseUrl,
      });
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Fetch a prompt from Langfuse by name and version (optional).
   * Returns the prompt string or null if Langfuse is not configured or prompt not found.
   */
  async getPrompt(name: string, version?: number): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const prompt = await this.client.getPrompt(name, version);
      return prompt.prompt;
    } catch (error) {
      console.error(`Failed to fetch prompt "${name}" from Langfuse:`, error);
      return null;
    }
  }

  /**
   * Create a trace for an LLM call with observability.
   * Returns a trace object that can be used to log generations.
   */
  trace(name: string, metadata?: Record<string, unknown>) {
    if (!this.client) {
      return null;
    }

    return this.client.trace({
      name,
      metadata,
    });
  }

  /**
   * Shutdown the Langfuse client and flush any pending events.
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
    }
  }
}
