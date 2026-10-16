export interface SpeechEnv {
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  SPEECH_API_KEY?: string;
  [key: string]: string | undefined;
}

function usable(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return false;
  return !/^(your_|MY_|TODO|changeme)/i.test(trimmed);
}

export interface ProviderStatus {
  openrouter: boolean;
  gemini: boolean;
  speech: boolean;
}

/** Which AI keys are present. Values of the keys are never returned. */
export function providerStatus(env: SpeechEnv): ProviderStatus {
  return {
    openrouter: usable(env.OPENROUTER_API_KEY),
    gemini: usable(env.GEMINI_API_KEY),
    speech: usable(env.SPEECH_API_KEY),
  };
}

/** Learner-facing notes when a provider key is missing. */
export function capabilityNotices(status: ProviderStatus): string[] {
  const notes: string[] = [];
  if (!status.openrouter) {
    notes.push('ET AI replies need OPENROUTER_API_KEY. You can type, but the teacher cannot answer until that key is set.');
  }
  if (!status.gemini) {
    notes.push('Spoken replies use this browser’s voice because GEMINI_API_KEY is not set.');
  }
  if (!status.speech) {
    notes.push('Voice notes use this browser’s transcript because SPEECH_API_KEY is not set.');
  }
  return notes;
}
