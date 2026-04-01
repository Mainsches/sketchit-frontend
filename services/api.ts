import AsyncStorage from '@react-native-async-storage/async-storage';

export type GenerateSketchPayload = {
  imageBase64?: string | null;
  imageUri?: string;
  category?: string;
  style?: string;
  material?: string;
  qualityMode?: 'fast' | 'balanced' | 'best';
};

export type StartGenerationPayload = {
  prompt: string;
  imageBase64?: string | null;
  mimeType?: string | null;
  sessionId?: string;
};

export type VariationPayload = {
  prompt?: string;
  variationIntent?: string;
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
  error?: {
    message?: string;
    details?: unknown;
  } | null;
  variationSeed?: number;
  variationIntent?: string;
  meta?: {
    promptUsed?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type StartGenerationResponse = {
  ok: boolean;
  generation: GenerationRecord;
};

export type GetGenerationResponse = {
  ok: boolean;
  generation: GenerationRecord;
};

export type GenerateSketchResponse = {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  jobId?: string;
  error?: string;
};

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
    }),
  });

  const data = await parseJsonSafe<StartGenerationResponse & { error?: string }>(response);

  if (!response.ok || !data?.generation) {
    throw new Error(getReadableError(response.status, data?.error));
  }

  return data;
}

export async function getGeneration(generationId: string): Promise<GetGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/generation/${generationId}`);
  const data = await parseJsonSafe<GetGenerationResponse & { error?: string }>(response);

  if (!response.ok || !data?.generation) {
    throw new Error(getReadableError(response.status, data?.error));
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
    }),
  });

  const data = await parseJsonSafe<StartGenerationResponse & { error?: string }>(response);

  if (!response.ok || !data?.generation) {
    throw new Error(getReadableError(response.status, data?.error));
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
        generation.error?.message || 'Die Bildgenerierung ist fehlgeschlagen.'
      );
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Die Generierung dauert zu lange. Bitte erneut versuchen.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function generateSketchConcept(
  payload: GenerateSketchPayload
): Promise<GenerateSketchResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Request failed with status ${response.status}`,
      };
    }

    const data = (await response.json()) as GenerateSketchResponse;
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
