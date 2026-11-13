// Grading with an OpenAI model: the alternative compared against Claude in eval/. Plain HTTP
// (Chat Completions with a strict JSON schema), so the Worker carries no second SDK.
import { RawGrade, RAW_GRADE_JSON_SCHEMA } from '../prompt';
import { ProviderError, type Provider } from './types';

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function openaiProvider(apiKey: string, model: string, fetcher: typeof fetch = fetch): Provider {
  return async ({ system, user }) => {
    let res: Response;
    try {
      res = await fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_completion_tokens: 2000,
          response_format: { type: 'json_schema', json_schema: { name: 'grade', strict: true, schema: RAW_GRADE_JSON_SCHEMA } },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ProviderError('failed', 'openai request failed');
    }
    if (!res.ok) throw new ProviderError(res.status === 429 || res.status >= 500 ? 'busy' : 'failed', `openai ${res.status}`);
    const data = (await res.json().catch(() => null)) as ChatResponse | null;
    const choice = data?.choices?.[0];
    if (choice?.message?.refusal) throw new ProviderError('refused', 'openai refusal');
    let parsed: unknown;
    try {
      parsed = JSON.parse(choice?.message?.content ?? '');
    } catch {
      throw new ProviderError('bad_output', `openai ${choice?.finish_reason ?? 'no content'}`);
    }
    const raw = RawGrade.safeParse(parsed);
    if (!raw.success) throw new ProviderError('bad_output', 'openai wrong shape');
    const u = data?.usage;
    return { raw: raw.data, usage: u ? { input: u.prompt_tokens ?? 0, output: u.completion_tokens ?? 0 } : null };
  };
}
