import { create } from 'zustand';

export type QualityMode = 'fast' | 'balanced' | 'best';
export type LanguageMode = 'en' | 'de';

type SettingsState = {
  language: LanguageMode;
  qualityMode: QualityMode;
  setLanguage: (value: LanguageMode) => void;
  setQualityMode: (value: QualityMode) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  qualityMode: 'balanced',
  setLanguage: (value) => set({ language: value }),
  setQualityMode: (value) => set({ qualityMode: value }),
}));

export function getQualityLabel(value: QualityMode) {
  if (value === 'fast') return 'Fast';
  if (value === 'best') return 'Best';
  return 'Balanced';
}