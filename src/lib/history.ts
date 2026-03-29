import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryItem = {
  id: string;
  createdAt: number;
  prompt: string;
  inputImage?: string;
  resultImage: string;
};

export const HISTORY_STORAGE_KEY = 'sketchit_history';

export async function loadHistoryItems(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);

    if (!raw) return [];

    const parsed: HistoryItem[] = JSON.parse(raw);
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.log('loadHistoryItems error:', error);
    return [];
  }
}

export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  try {
    const existing = await loadHistoryItems();
    const updated = [item, ...existing];
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.log('saveHistoryItem error:', error);
  }
}