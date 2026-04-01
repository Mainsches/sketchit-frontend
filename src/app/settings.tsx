import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import TopBar from '../../components/TopBar';
import type { GenerationMode, UsageInfo } from '../../services/api';
import { fetchUsage, getOrCreateSessionId, resetStoredSessionId, setFakePremium } from '../../services/api';

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
    subtitle: 'Best reserved for paid users later.',
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
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [isPremiumSaving, setIsPremiumSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSessionAndUsage();
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

  const loadSessionAndUsage = async () => {
    try {
      const id = await getOrCreateSessionId();
      setSessionId(id);
      const usageInfo = await fetchUsage(id);
      setUsage(usageInfo);
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
    if (mode === 'premium' && !usage?.isPremium) {
      Alert.alert('Premium only', 'Premium mode should stay locked on the free plan. Use Medium as the default for now.');
      return;
    }

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
      const usageInfo = await fetchUsage(nextSessionId);
      setUsage(usageInfo);
      Alert.alert('New session created', 'The next generations will use a fresh session. Fake premium will be off again on the new session.');
    } catch {
      Alert.alert('Error', 'The session could not be reset.');
    } finally {
      setIsResetting(false);
    }
  };

  const handlePremiumToggle = async (value: boolean) => {
    if (isPremiumSaving) return;

    setIsPremiumSaving(true);
    try {
      const id = await getOrCreateSessionId();
      const usageInfo = await setFakePremium(value, id);
      setUsage(usageInfo);

      if (!value && settings.defaultGenerationMode === 'premium') {
        const nextSettings = {
          ...settings,
          defaultGenerationMode: 'balanced' as GenerationMode,
        };
        await saveSettings(nextSettings);
      }
    } catch {
      Alert.alert('Error', 'Fake premium could not be updated.');
    } finally {
      setIsPremiumSaving(false);
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
          <Text style={styles.heroTitle}>Premium-ready monetization</Text>
          <Text style={styles.heroSubtitle}>
            Free users get 2 Medium images per day. Premium later unlocks 50 images per day, Premium mode and variations.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current plan</Text>

          <View style={styles.planRow}>
            <View>
              <Text style={styles.planTitle}>{usage?.isPremium ? 'Premium' : 'Free'}</Text>
              <Text style={styles.planSubtitle}>
                {usage
                  ? `${usage.remainingToday} of ${usage.dailyLimit} images left today`
                  : 'Loading usage...'}
              </Text>
            </View>
            <Text style={[styles.planBadge, usage?.isPremium && styles.planBadgePremium]}>
              {usage?.isPremium ? 'Premium' : 'Free'}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    usage ? (usage.dailyCount / Math.max(usage.dailyLimit, 1)) * 100 : 0
                  )}%`,
                },
              ]}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Fake Premium (dev only)</Text>
              <Text style={styles.rowSubtitle}>
                Turn this on for testing the premium UX and limits before Google Play Billing is connected.
              </Text>
            </View>
            <Switch
              value={Boolean(usage?.isPremium)}
              onValueChange={handlePremiumToggle}
              disabled={isPremiumSaving}
              trackColor={{ false: '#27272a', true: '#3f3f46' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Default generation mode</Text>
          <Text style={styles.sectionIntro}>
            Medium should stay your default. Premium mode is visible, but stays locked unless Fake Premium is enabled.
          </Text>

          <View style={styles.modeList}>
            {MODE_OPTIONS.map((mode) => {
              const active = settings.defaultGenerationMode === mode.key;
              const blocked = mode.key === 'premium' && !usage?.isPremium;

              return (
                <Pressable
                  key={mode.key}
                  style={[styles.modeCard, active && styles.modeCardActive, blocked && styles.modeCardBlocked]}
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
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  planTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  planSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 4,
  },
  planBadge: {
    color: '#d4d4d8',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#26262b',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
  },
  planBadgePremium: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderColor: '#ffffff',
  },
  progressTrack: {
    marginTop: 14,
    height: 8,
    backgroundColor: '#1a1a1f',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 999,
  },
  modeList: {
    gap: 10,
  },
  modeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f1f23',
    backgroundColor: '#111113',
    padding: 16,
  },
  modeCardActive: {
    borderColor: '#ffffff',
    backgroundColor: '#151518',
  },
  modeCardBlocked: {
    opacity: 0.45,
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 10,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modeActiveBadge: {
    color: '#000000',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
  },
  modeSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#1f1f23',
    marginVertical: 16,
  },
  smallLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sessionValue: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
