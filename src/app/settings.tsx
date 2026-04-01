import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import TopBar from '../../components/TopBar';
import { getOrCreateSessionId, resetStoredSessionId } from '../../services/api';

type AppSettings = {
  autoSave: boolean;
  haptics: boolean;
};

const SETTINGS_KEY = 'sketchit_ui_settings_v1';
const defaultSettings: AppSettings = {
  autoSave: true,
  haptics: true,
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

  const toggleSetting = async (key: keyof AppSettings, value: boolean) => {
    await saveSettings({
      ...settings,
      [key]: value,
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
            This screen is now stable and already prepared for future limits, credits, cloud sync and account settings.
          </Text>
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
              trackColor={{ false: '#27272a', true: '#ffffff' }}
              thumbColor={settings.autoSave ? '#000000' : '#ffffff'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Haptics</Text>
              <Text style={styles.rowSubtitle}>Use small vibration feedback for actions and completed generations.</Text>
            </View>
            <Switch
              value={settings.haptics}
              onValueChange={(value) => toggleSetting('haptics', value)}
              trackColor={{ false: '#27272a', true: '#ffffff' }}
              thumbColor={settings.haptics ? '#000000' : '#ffffff'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Generation session</Text>
          <Text style={styles.smallLabel}>Current session ID</Text>
          <Text style={styles.sessionValue}>{sessionId}</Text>
          <Text style={styles.helperText}>
            This groups generated results together and prepares the app for a future chat-style history.
          </Text>

          <Pressable
            onPress={handleResetSession}
            style={[styles.primaryButton, isResetting && styles.buttonDisabled]}
            disabled={isResetting}
          >
            <Text style={styles.primaryButtonText}>Start new session</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Coming next</Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>• chat-based generation history</Text>
            <Text style={styles.featureItem}>• multiple image variants</Text>
            <Text style={styles.featureItem}>• premium credits and daily limits</Text>
            <Text style={styles.featureItem}>• optional accounts and cloud sync</Text>
            <Text style={styles.featureItem}>• more precise prompt controls</Text>
          </View>
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
    marginBottom: 16,
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
    marginBottom: 10,
  },
  helperText: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  primaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  featureList: {
    gap: 10,
  },
  featureItem: {
    color: '#e4e4e7',
    fontSize: 14,
    lineHeight: 20,
  },
});
