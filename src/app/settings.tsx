import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import TopBar from '../../components/TopBar';
import type { GenerationMode } from '../../services/api';
import { getOrCreateSessionId, resetStoredSessionId } from '../../services/api';

type AppSettings = {
  autoSave: boolean;
  haptics: boolean;
  defaultGenerationMode: GenerationMode;
};

const SETTINGS_KEY = 'sketchit_ui_settings_v1';
const MODE_OPTIONS: { key: GenerationMode; label: string; subtitle: string }[] = [
  {
    key: 'fast',
    label: 'Fast',
    subtitle: 'Lower latency and lower cost.',
  },
  {
    key: 'balanced',
    label: 'Medium',
    subtitle: 'Best default. Good quality, speed and cost.',
  },
  {
    key: 'premium',
    label: 'Premium',
    subtitle: 'Richer output feel. Best later for paid users.',
  },
];

const defaultSettings: AppSettings = {
  autoSave: true,
  haptics: true,
  defaultGenerationMode: 'balanced',
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sessionId, setSessionId] = useState<string>('Loading...');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSession();
  }, []);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      setSettings({ ...defaultSettings, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  };

  const saveSettings = async (next: AppSettings) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      Alert.alert('Error', 'Settings could not be saved.');
    }
  };

  const loadSession = async () => {
    try {
      const id = await getOrCreateSessionId();
      setSessionId(id);
    } catch {
      setSessionId('Unavailable');
    }
  };

  const toggleSetting = async (key: keyof Pick<AppSettings, 'autoSave' | 'haptics'>, value: boolean) => {
    await saveSettings({
      ...settings,
      [key]: value,
    });
  };

  const setDefaultMode = async (mode: GenerationMode) => {
    await saveSettings({
      ...settings,
      defaultGenerationMode: mode,
    });
  };

  const handleResetSession = async () => {
    if (isResetting) return;

    setIsResetting(true);
    try {
      const nextSessionId = await resetStoredSessionId();
      setSessionId(nextSessionId);
      Alert.alert('New session created', 'The next generations will use a fresh session.');
    } catch {
      Alert.alert('Error', 'The session could not be reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title="Settings" showBack />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Premium-ready foundation</Text>
          <Text style={styles.heroSubtitle}>
            Medium is now the recommended default mode. It keeps SketchIT fast, polished and much easier to control on cost.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Default generation mode</Text>
          <Text style={styles.sectionIntro}>
            This controls the standard output mode when you open the app. You can still change it on the main screen before sending.
          </Text>

          <View style={styles.modeList}>
            {MODE_OPTIONS.map((mode) => {
              const active = settings.defaultGenerationMode === mode.key;

              return (
                <Pressable
                  key={mode.key}
                  style={[styles.modeCard, active && styles.modeCardActive]}
                  onPress={() => setDefaultMode(mode.key)}
                >
                  <View style={styles.modeHeaderRow}>
                    <Text style={styles.modeTitle}>{mode.label}</Text>
                    {active ? <Text style={styles.modeActiveBadge}>Default</Text> : null}
                  </View>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Experience</Text>

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Auto-save results</Text>
              <Text style={styles.rowSubtitle}>Save each finished image to local history automatically.</Text>
            </View>
            <Switch
              value={settings.autoSave}
              onValueChange={(value) => toggleSetting('autoSave', value)}
              trackColor={{ false: '#27272a', true: '#3f3f46' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Haptics</Text>
              <Text style={styles.rowSubtitle}>Use subtle touch feedback for generate, save and actions.</Text>
            </View>
            <Switch
              value={settings.haptics}
              onValueChange={(value) => toggleSetting('haptics', value)}
              trackColor={{ false: '#27272a', true: '#3f3f46' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Session</Text>

          <Text style={styles.smallLabel}>Current session ID</Text>
          <Text style={styles.sessionValue}>{sessionId}</Text>

          <Pressable
            onPress={handleResetSession}
            style={[styles.primaryButton, isResetting && styles.primaryButtonDisabled]}
            disabled={isResetting}
          >
            <Text style={styles.primaryButtonText}>
              {isResetting ? 'Resetting...' : 'Start new session'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#0b0b0d',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 20,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: '#1f1f23',
    borderRadius: 24,
    padding: 18,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionIntro: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  modeList: {
    gap: 10,
  },
  modeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f1f23',
    backgroundColor: '#111113',
    padding: 14,
  },
  modeCardActive: {
    borderColor: '#ffffff',
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modeActiveBadge: {
    color: '#000000',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
  },
  modeSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  rowSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1f',
    marginVertical: 16,
  },
  smallLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sessionValue: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
