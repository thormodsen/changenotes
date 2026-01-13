# Langfuse Config Guide for OpenRouter Parameters

## Current Parameters Sent to OpenRouter

The following parameters are currently sent to OpenRouter API:

### Headers
- `Authorization`: Bearer token (from `OPENROUTER_API_KEY`)
- `Content-Type`: `application/json`
- `HTTP-Referer`: `https://github.com/thormodsen/changelog-creator` (OpenRouter requirement)
- `X-Title`: `Slack Release Monitor` (OpenRouter requirement)

### Request Body Parameters

#### For Release Extraction (`release-extraction` prompt)
- `model`: `anthropic/claude-sonnet-4` (default)
- `max_tokens`: `4096` (default)
- `messages`: Array with user message containing the prompt and Slack messages
- `temperature`: Optional (not set by default)
- `top_p`: Optional (not set by default)

#### For Weekly Summary (`weekly-summary` prompt)
- `model`: `anthropic/claude-sonnet-4` (default)
- `max_tokens`: `2048` (default)
- `messages`: Array with user message containing the prompt and releases
- `temperature`: Optional (not set by default)
- `top_p`: Optional (not set by default)

## Configuring Parameters via Langfuse

You can now configure these parameters in Langfuse by adding a JSON config to your prompts.

### Step 1: Edit Your Prompt in Langfuse

1. Go to your Langfuse dashboard
2. Navigate to **Prompts** → Select your prompt (`release-extraction` or `weekly-summary`)
3. Find the **Config** field (JSON editor)

### Step 2: Add Config JSON

Add a JSON object with the parameters you want to override. Here's an example:

```json
{
  "model": "anthropic/claude-sonnet-4",
  "max_tokens": 4096,
  "temperature": 0.7,
  "top_p": 0.9,
  "httpReferer": "https://github.com/thormodsen/changelog-creator",
  "xTitle": "Slack Release Monitor"
}
```

### Configurable Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `anthropic/claude-sonnet-4` | The model to use (e.g., `anthropic/claude-opus-3`, `openai/gpt-4-turbo`) |
| `max_tokens` | number | `4096` (extraction) / `2048` (summary) | Maximum tokens in the response |
| `temperature` | number | Not set | Sampling temperature (0-2). Higher = more creative |
| `top_p` | number | Not set | Nucleus sampling parameter (0-1) |
| `httpReferer` | string | `https://github.com/thormodsen/changelog-creator` | OpenRouter HTTP-Referer header |
| `xTitle` | string | `Slack Release Monitor` | OpenRouter X-Title header |

### Example Configurations

#### Example 1: Use a Different Model
```json
{
  "model": "anthropic/claude-opus-3",
  "max_tokens": 4096
}
```

#### Example 2: Adjust Creativity
```json
{
  "model": "anthropic/claude-sonnet-4",
  "max_tokens": 4096,
  "temperature": 0.3,
  "top_p": 0.9
}
```

#### Example 3: Custom OpenRouter Headers
```json
{
  "model": "anthropic/claude-sonnet-4",
  "max_tokens": 4096,
  "httpReferer": "https://mycompany.com",
  "xTitle": "My Company Release Monitor"
}
```

#### Example 4: Minimal Config (Just Override Model)
```json
{
  "model": "openai/gpt-4-turbo"
}
```

### How It Works

1. When the code fetches a prompt from Langfuse, it also retrieves the `config` JSON
2. Any parameters in the config override the defaults
3. Parameters not in the config use the defaults
4. The config is applied to both the OpenRouter API call and Langfuse tracing

### Notes

- **Versioning**: Config is versioned with your prompt, so you can test different configurations
- **Fallback**: If Langfuse is not configured or prompt not found, defaults are used
- **Validation**: Invalid config values will cause errors - make sure numbers are numbers and strings are strings
- **Debugging**: Use `--verbose` flag to see which config values are being used

### Testing

After updating your Langfuse prompt config:

1. Run with `--verbose` to see debug output:
   ```bash
   node dist/index.js --start 2025-12-01 --days 7 --fresh --verbose
   ```

2. Look for this in the output:
   ```
   [DEBUG] Using config from Langfuse: { model: '...', max_tokens: ... }
   ```

3. Check Langfuse dashboard to see the actual API calls with your config values
