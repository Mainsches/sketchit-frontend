import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryItem = {
  id: string;
  imageUri: string;
  category: string;
  style: string;
  material: string;
  createdAt: string;
};

const HISTORY_KEY = 'sketchit_history';
const SETTINGS_KEY = 'sketchit_settings';

export async function getHistory(): Promise<HistoryItem[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

export async function saveHistory(items: HistoryItem[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export async function addHistoryItem(item: HistoryItem) {
  const current = await getHistory();
  await saveHistory([item, ...current]);
}

export async function saveSettings(value: unknown) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}

export async function getSettings<T>(fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}