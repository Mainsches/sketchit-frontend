import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TopBar from '../../components/TopBar';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <TopBar title="Settings" showBack />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Settings options will appear here later.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>Screen works again</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#0b0b0b',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 24,
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 15,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: '#0b0b0b',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 18,
    padding: 16,
  },
  infoLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});