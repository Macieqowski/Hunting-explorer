// Grading with a Claude model through the official SDK (structured output, so the answer
// always has the agreed shape).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { RawGrade } from '../prompt';
import { ProviderError, type Provider } from './types';

export function anthropicProvider(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  return async ({ system, user }) => {
    let res;
    try {
      res = await client.messages.parse({
        model,
        // Room for the per-point evidence of an 8-point question; the reply is ~300-500 tokens.
        max_tokens: 2000,
        // A short rubric check: the evidence fields in the output do the reasoning.
        thinking: { type: 'disabled' },
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low', format: zodOutputFormat(RawGrade) },
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ProviderError('busy', 'anthropic 429');
      if (e instanceof Anthropic.APIError) throw new ProviderError(e.status === 529 || e.status === 503 ? 'busy' : 'failed', `anthropic ${e.status ?? 'error'}`);
      throw new ProviderError('failed', 'anthropic request failed');
    }
    if (res.stop_reason === 'refusal') throw new ProviderError('refused', 'anthropic refusal');
    if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new ProviderError('bad_output', `anthropic ${res.stop_reason}`);
    return { raw: res.parsed_output, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
  };
}
