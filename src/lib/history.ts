import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GenerationMode } from '../../services/api';

export type HistoryItem = {
  id: string;
  createdAt: number;
  prompt: string;
  inputImage?: string;
  resultImage: string;
  generationId?: string;
  sessionId?: string;
  sourceGenerationId?: string | null;
  type?: 'base' | 'variation' | string;
  generationMode?: GenerationMode;
};

export const HISTORY_STORAGE_KEY = 'sketchit_history';
const MAX_HISTORY_ITEMS = 40;
const MAX_PROMPT_LENGTH = 500;
const MAX_IMAGE_URI_LENGTH = 4000;

function isProbablyBase64(value?: string): boolean {
  if (!value) return false;

  return (
    value.startsWith('data:image/') ||
    value.length > MAX_IMAGE_URI_LENGTH ||
    (!value.startsWith('file://') &&
      !value.startsWith('content://') &&
      !value.startsWith('http://') &&
      !value.startsWith('https://') &&
      /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 200)))
  );
}

function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeHistoryItem(item: HistoryItem): HistoryItem {
  const safePrompt = sanitizeString(item.prompt, MAX_PROMPT_LENGTH);

  const safeResultImage =
    typeof item.resultImage === 'string' && !isProbablyBase64(item.resultImage)
      ? item.resultImage
      : '';

  const safeInputImage =
    typeof item.inputImage === 'string' && !isProbablyBase64(item.inputImage)
      ? item.inputImage
      : undefined;

  return {
    id:
      typeof item.id === 'string' && item.id.trim()
        ? item.id
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt:
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
    prompt: safePrompt,
    inputImage: safeInputImage,
    resultImage: safeResultImage,
    generationId:
      typeof item.generationId === 'string' ? item.generationId : undefined,
    sessionId: typeof item.sessionId === 'string' ? item.sessionId : undefined,
    sourceGenerationId:
      typeof item.sourceGenerationId === 'string' || item.sourceGenerationId === null
        ? item.sourceGenerationId
        : undefined,
    type: typeof item.type === 'string' ? item.type : 'base',
    generationMode: item.generationMode,
  };
}

function dedupeHistoryItems(items: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>();
  const result: HistoryItem[] = [];

  for (const item of items) {
    const key =
      item.generationId ||
      item.id ||
      `${item.resultImage}_${item.createdAt}_${item.prompt}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export async function loadHistoryItems(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const sanitized = parsed
      .map((item) => sanitizeHistoryItem(item as HistoryItem))
      .filter((item) => !!item.resultImage);

    return sanitized.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.log('loadHistoryItems error:', error);

    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      console.log('Corrupted or oversized history was cleared.');
    } catch (clearError) {
      console.log('Failed to clear corrupted history:', clearError);
    }

    return [];
  }
}

export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  try {
    const sanitizedNewItem = sanitizeHistoryItem(item);

    if (!sanitizedNewItem.resultImage) {
      console.log('saveHistoryItem skipped: invalid or oversized resultImage');
      return;
    }

    const existing = await loadHistoryItems();
    const combined = [sanitizedNewItem, ...existing];
    const deduped = dedupeHistoryItems(combined);
    const trimmed = deduped.slice(0, MAX_HISTORY_ITEMS);

    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.log('saveHistoryItem error:', error);
  }
}

export async function clearHistoryItems(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.log('clearHistoryItems error:', error);
  }
}