import AsyncStorage from '@react-native-async-storage/async-storage';

export type GenerationMode = 'fast' | 'balanced' | 'premium';

export type StartGenerationPayload = {
  prompt: string;
  imageBase64?: string | null;
  mimeType?: string | null;
  sessionId?: string;
  generationMode?: GenerationMode;
};

export type VariationPayload = {
  prompt?: string;
  variationIntent?: string;
  generationMode?: GenerationMode;
};

export type GenerationRecord = {
  id: string;
  sessionId: string;
  sourceGenerationId?: string | null;
  type: 'base' | 'variation' | string;
  status: 'queued' | 'pending' | 'processing' | 'done' | 'error' | string;
  prompt: string;
  mimeType?: string | null;
  hasSketch?: boolean;
  imageBase64?: string | null;
  imageDataUrl?: string | null;
  generationMode?: GenerationMode;
  error?: {
    message?: string;
    details?: unknown;
  } | null;
  variationSeed?: number | null;
  variationIntent?: string | null;
  meta?: {
    promptUsed?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type UsageInfo = {
  sessionId: string;
  isPremium: boolean;
  dailyCount: number;
  dailyLimit: number;
  remainingToday: number;
  totalCount: number;
  resetDayKey: string;
  canUsePremiumMode: boolean;
  canUseVariations: boolean;
};

export type StartGenerationResponse = {
  ok: boolean;
  generation: GenerationRecord;
  usage?: UsageInfo;
};

export type GetGenerationResponse = {
  ok: boolean;
  generation: GenerationRecord;
};

export type UsageResponse = {
  ok: boolean;
  usage: UsageInfo;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  usage?: UsageInfo;

  constructor(message: string, status: number, code?: string, usage?: UsageInfo) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.usage = usage;
  }
}

const API_BASE_URL = 'https://sketchit-backend-plov.onrender.com';
const SESSION_STORAGE_KEY = 'sketchit_active_session_id';

function createLocalId(prefix = 'session') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getReadableError(status: number, fallback?: string) {
  if (fallback?.trim()) return fallback;
  return `Request failed with status ${status}`;
}

function toApiError(
  status: number,
  data?: { error?: string; code?: string; usage?: UsageInfo } | null
) {
  return new ApiError(
    getReadableError(status, data?.error),
    status,
    data?.code,
    data?.usage
  );
}

export async function getOrCreateSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const newSessionId = createLocalId('session');
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

export async function resetStoredSessionId(): Promise<string> {
  const newSessionId = createLocalId('session');
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

export async function fetchUsage(sessionId?: string): Promise<UsageInfo> {
  const safeSessionId = sessionId || (await getOrCreateSessionId());
  const response = await fetch(`${API_BASE_URL}/usage/${safeSessionId}`);
  const data = await parseJsonSafe<UsageResponse & { error?: string; code?: string }>(response);

  if (!response.ok || !data?.usage) {
    throw toApiError(response.status, data);
  }

  return data.usage;
}

export async function setFakePremium(
  isPremium: boolean,
  sessionId?: string
): Promise<UsageInfo> {
  const safeSessionId = sessionId || (await getOrCreateSessionId());
  const response = await fetch(`${API_BASE_URL}/session/${safeSessionId}/premium`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isPremium }),
  });

  const data = await parseJsonSafe<UsageResponse & { error?: string; code?: string }>(response);

  if (!response.ok || !data?.usage) {
    throw toApiError(response.status, data);
  }

  return data.usage;
}

export async function startGeneration(
  payload: StartGenerationPayload
): Promise<StartGenerationResponse> {
  const sessionId = payload.sessionId || (await getOrCreateSessionId());

  const response = await fetch(`${API_BASE_URL}/generation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: payload.prompt,
      imageBase64: payload.imageBase64 || null,
      mimeType: payload.mimeType || 'image/jpeg',
      sessionId,
      generationMode: payload.generationMode || 'balanced',
    }),
  });

  const data = await parseJsonSafe<StartGenerationResponse & { error?: string; code?: string; usage?: UsageInfo }>(response);

  if (!response.ok || !data?.generation) {
    throw toApiError(response.status, data);
  }

  return data;
}

export async function getGeneration(generationId: string): Promise<GetGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/generation/${generationId}`);
  const data = await parseJsonSafe<GetGenerationResponse & { error?: string; code?: string }>(response);

  if (!response.ok || !data?.generation) {
    throw toApiError(response.status, data);
  }

  return data;
}

export async function createVariation(
  generationId: string,
  payload: VariationPayload = {}
): Promise<StartGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/generation/${generationId}/variation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: payload.prompt,
      variationIntent: payload.variationIntent || 'alternate',
      generationMode: payload.generationMode || 'balanced',
    }),
  });

  const data = await parseJsonSafe<StartGenerationResponse & { error?: string; code?: string; usage?: UsageInfo }>(response);

  if (!response.ok || !data?.generation) {
    throw toApiError(response.status, data);
  }

  return data;
}

export async function pollGenerationUntilFinished(
  generationId: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
  }
): Promise<GenerationRecord> {
  const intervalMs = options?.intervalMs ?? 1800;
  const timeoutMs = options?.timeoutMs ?? 120000;
  const startedAt = Date.now();

  while (true) {
    const result = await getGeneration(generationId);
    const generation = result.generation;

    if (generation.status === 'done') {
      return generation;
    }

    if (generation.status === 'error') {
      throw new Error(
        generation.error?.message || 'The image generation failed.'
      );
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('The generation is taking too long. Please try again.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
