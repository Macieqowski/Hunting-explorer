import type { RawGrade } from '../prompt';

export interface GradeRequest {
  system: string;
  user: string;
}

export interface Usage {
  input: number;
  output: number;
}

export interface ProviderResult {
  raw: RawGrade;
  usage: Usage | null;
}

/**
 * Why a provider did not return a grade: `busy` = rate limited or overloaded (worth trying
 * later), `refused` = the model declined, `bad_output` = not the agreed shape, `failed` = the rest.
 */
export class ProviderError extends Error {
  constructor(
    readonly code: 'busy' | 'refused' | 'bad_output' | 'failed',
    message: string = code,
  ) {
    super(message);
  }
}

export type Provider = (req: GradeRequest) => Promise<ProviderResult>;
