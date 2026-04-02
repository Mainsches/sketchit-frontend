import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import TopBar from '../../components/TopBar';

const AUTO_SAVE_SETTING_KEY = 'sketchit_auto_save_generated_images';

export default function SettingsScreen() {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTO_SAVE_SETTING_KEY);
      setAutoSaveEnabled(raw === 'true');
    } catch (error) {
      console.log('load settings error:', error);
      setAutoSaveEnabled(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const onToggleAutoSave = async (value: boolean) => {
    try {
      setIsSaving(true);
      setAutoSaveEnabled(value);
      await AsyncStorage.setItem(AUTO_SAVE_SETTING_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.log('save auto save setting error:', error);
      setAutoSaveEnabled((prev) => !prev);
      Alert.alert('Error', 'The setting could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title="Settings" showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Generation</Text>

          <View style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.iconWrap}>
                <Ionicons name="download-outline" size={18} color="#ffffff" />
              </View>

              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Auto-save generated images</Text>
                <Text style={styles.rowSubtitle}>
                  Automatically save every newly generated image to your gallery.
                </Text>
              </View>

              <Switch
                value={autoSaveEnabled}
                onValueChange={onToggleAutoSave}
                disabled={isSaving}
                trackColor={{ false: '#2a2a2f', true: '#ffffff' }}
                thumbColor={autoSaveEnabled ? '#000000' : '#ffffff'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Free plan</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Current test build</Text>
            <Text style={styles.infoText}>2 medium images per day</Text>
            <Text style={styles.infoText}>Variations are not active yet</Text>
            <Text style={styles.infoText}>Premium is coming later</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Auto-save is optional because some users do not want every generated image to be stored automatically.
            </Text>
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

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  section: {
    marginBottom: 22,
  },

  sectionLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  card: {
    borderRadius: 20,
    backgroundColor: '#0f0f10',
    borderWidth: 1,
    borderColor: '#1d1d1f',
    padding: 14,
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  rowTextWrap: {
    flex: 1,
    marginRight: 12,
  },

  rowTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },

  rowSubtitle: {
    color: '#9a9aa2',
    fontSize: 13,
    lineHeight: 19,
  },

  infoCard: {
    borderRadius: 20,
    backgroundColor: '#0f0f10',
    borderWidth: 1,
    borderColor: '#1d1d1f',
    padding: 14,
  },

  infoTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },

  infoText: {
    color: '#9a9aa2',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});