import type { SlackMessage } from './slack-client.js';
import type { LangfuseClient } from './langfuse-client.js';

export interface Release {
  date: string;
  title: string;
  description: string;
  sourceMessageId: string;
}

const DEFAULT_EXTRACTION_PROMPT = `You are analyzing Slack messages to extract release information.

Identify any messages that mention:
- Software releases or version updates
- Deployments to production or staging
- Shipped features or functionality
- Hotfixes or bug fixes that were deployed

For each release found, extract:
- date: The date in YYYY-MM-DD format (use the date shown in brackets, e.g. [2025-12-01])
- title: A brief title for the release
- description: A summary of what was released/changed
- sourceMessageId: The ID of the message containing this release

Respond with a JSON array. If no releases are found, respond with an empty array [].

Example output:
[{"date":"2024-01-15","title":"v2.1.0 Release","description":"Added user authentication and fixed login bug","sourceMessageId":"1705312800.000100"}]

Only output valid JSON, nothing else.`;

interface OpenRouterConfig {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  // OpenRouter-specific headers
  httpReferer?: string;
  xTitle?: string;
}

export class ReleaseExtractor {
  private apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = 'anthropic/claude-sonnet-4';
  private readonly defaultMaxTokens = 4096;
  private langfuse: LangfuseClient | null;
  private verbose: boolean;

  constructor(apiKey: string, langfuse?: LangfuseClient | null, verbose: boolean = false) {
    this.apiKey = apiKey;
    this.langfuse = langfuse ?? null;
    this.verbose = verbose;
  }

  async extractReleases(messages: SlackMessage[]): Promise<Release[]> {
    if (messages.length === 0) {
      return [];
    }

    // Try to fetch prompt and config from Langfuse, fallback to default
    let prompt = DEFAULT_EXTRACTION_PROMPT;
    let promptSource = 'default';
    let config: OpenRouterConfig = {};

    if (this.langfuse?.isEnabled()) {
      const langfuseResult = await this.langfuse.getPromptWithConfig('release-extraction');
      if (langfuseResult) {
        prompt = langfuseResult.prompt;
        promptSource = 'Langfuse';
        
        // Extract config values
        if (langfuseResult.config.model) {
          config.model = String(langfuseResult.config.model);
        }
        if (langfuseResult.config.max_tokens) {
          config.max_tokens = Number(langfuseResult.config.max_tokens);
        }
        if (langfuseResult.config.temperature !== undefined) {
          config.temperature = Number(langfuseResult.config.temperature);
        }
        if (langfuseResult.config.top_p !== undefined) {
          config.top_p = Number(langfuseResult.config.top_p);
        }
        if (langfuseResult.config.httpReferer) {
          config.httpReferer = String(langfuseResult.config.httpReferer);
        }
        if (langfuseResult.config.xTitle) {
          config.xTitle = String(langfuseResult.config.xTitle);
        }

        if (this.verbose) {
          console.error(`[DEBUG] Using prompt from Langfuse (length: ${prompt.length} chars)`);
          if (Object.keys(config).length > 0) {
            console.error(`[DEBUG] Using config from Langfuse:`, config);
          }
        }
      } else {
        if (this.verbose) {
          console.error(`[DEBUG] Langfuse prompt "release-extraction" not found, using default prompt`);
        }
      }
    } else {
      if (this.verbose) {
        console.error(`[DEBUG] Using default prompt (Langfuse not enabled)`);
      }
    }

    const formattedMessages = messages
      .map((m) => {
        const date = new Date(parseFloat(m.timestamp) * 1000).toISOString().split('T')[0];
        return `[${m.id}] [${date}] ${m.text}`;
      })
      .join('\n\n');

    const userContent = `${prompt}\n\nMessages to analyze:\n\n${formattedMessages}`;

    // Use config values or defaults (needed for trace)
    const model = config.model || this.defaultModel;
    const maxTokens = config.max_tokens || this.defaultMaxTokens;

    // Create Langfuse trace if enabled
    const trace = this.langfuse?.isEnabled()
      ? this.langfuse.trace('release-extraction', {
          messageCount: messages.length,
          model,
        })
      : null;

    const generation = trace
      ? trace.generation({
          name: 'extract-releases',
          model,
          modelParameters: {
            max_tokens: maxTokens,
            ...(config.temperature !== undefined && { temperature: config.temperature }),
            ...(config.top_p !== undefined && { top_p: config.top_p }),
          },
          input: userContent,
        })
      : null;

    // Build request body with config values
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    };

    // Add optional parameters if present in config
    if (config.temperature !== undefined) {
      requestBody.temperature = config.temperature;
    }
    if (config.top_p !== undefined) {
      requestBody.top_p = config.top_p;
    }

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.httpReferer || 'https://github.com/thormodsen/changelog-creator',
      'X-Title': config.xTitle || 'Slack Release Monitor',
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (generation) {
        generation.end({
          level: 'ERROR',
          statusMessage: `OpenRouter API error: ${response.status} ${response.statusText}`,
        });
      }
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      if (this.verbose) {
        console.error(`[DEBUG] No content in LLM response`);
      }
      if (generation) {
        generation.end({
          level: 'WARNING',
          statusMessage: 'No content in response',
        });
      }
      return [];
    }

    if (this.verbose) {
      console.error(`[DEBUG] LLM response (first 500 chars): ${textContent.substring(0, 500)}`);
    }

    // Log the generation to Langfuse
    if (generation) {
      generation.end({
        output: textContent,
        usage: {
          input: data.usage?.prompt_tokens ?? 0,
          output: data.usage?.completion_tokens ?? 0,
          total: data.usage?.total_tokens ?? 0,
        },
      });
    }

    // Try to extract JSON from markdown code blocks if present
    let jsonText = textContent.trim();
    
    // Remove markdown code block markers (```json or ```)
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      // Remove first line (```json or ```)
      lines.shift();
      // Remove last line if it's just ```
      if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
        lines.pop();
      }
      jsonText = lines.join('\n').trim();
    }

    try {
      const releases = JSON.parse(jsonText) as Release[];
      const result = Array.isArray(releases) ? releases : [];
      
      if (this.verbose) {
        console.error(`[DEBUG] Parsed ${result.length} releases from JSON response`);
        if (result.length === 0 && jsonText !== '[]') {
          console.error(`[DEBUG] WARNING: Response was not empty array but parsed to 0 releases. Full response: ${textContent.substring(0, 200)}...`);
        }
      }
      
      // Update trace with result metadata
      if (trace) {
        trace.update({
          metadata: {
            releaseCount: result.length,
            promptSource,
            model,
            maxTokens,
          },
        });
      }

      return result;
    } catch (parseError) {
      if (this.verbose) {
        console.error(`[DEBUG] Failed to parse JSON response:`, parseError);
        console.error(`[DEBUG] Response text (first 500 chars): ${textContent.substring(0, 500)}`);
        console.error(`[DEBUG] Attempted to parse (after code block removal): ${jsonText.substring(0, 200)}`);
      }
      
      // Check if response looks like markdown instead of JSON
      if (textContent.trim().startsWith('```') || textContent.includes('###')) {
        console.error(`\n[ERROR] Langfuse prompt returned markdown instead of JSON.`);
        console.error(`The prompt "release-extraction" in Langfuse must instruct the LLM to return a JSON array.`);
        console.error(`Expected format: [{"date":"2024-01-15","title":"v2.1.0 Release","description":"...","sourceMessageId":"..."}]`);
        console.error(`\nCurrent response format appears to be markdown changelog format.`);
        console.error(`Please update your Langfuse prompt to explicitly request JSON output.\n`);
      }
      
      if (generation) {
        generation.end({
          level: 'ERROR',
          statusMessage: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response appears to be markdown, not JSON.`,
        });
      }
      return [];
    }
  }
}
