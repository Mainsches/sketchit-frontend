import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import TopBar from '../../components/TopBar';
import { PREMIUM_PRODUCT_ID, getPremiumStatusLabel } from '../../lib/billingService';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <TopBar title="Settings" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Current plan</Text>
          <Text style={styles.title}>Free</Text>
          <Text style={styles.body}>2 medium images per day.</Text>
          <Text style={styles.body}>Premium is not active in this internal test build.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Premium</Text>
          <Text style={styles.rowTitle}>Status</Text>
          <Text style={styles.rowValue}>{getPremiumStatusLabel()}</Text>
          <Text style={styles.rowTitle}>Planned product ID</Text>
          <Text style={styles.rowValue}>{PREMIUM_PRODUCT_ID}</Text>
          <Text style={styles.helperText}>
            Planned later: more daily generations, variations and premium mode through Google Play Billing.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>App</Text>
          <Text style={styles.rowTitle}>History</Text>
          <Text style={styles.helperText}>Your generated images stay available locally on this device.</Text>
          <Text style={styles.rowTitle}>Privacy</Text>
          <Text style={styles.helperText}>No login is required in this build. Your local history stays on your device.</Text>
          <Text style={styles.rowTitle}>Internal test</Text>
          <Text style={styles.helperText}>This build is focused on core generation flow, stability and UX feedback.</Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => {}}
        >
          <Text style={styles.buttonText}>Premium coming soon</Text>
        </Pressable>
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
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#0b0b0c',
    borderWidth: 1,
    borderColor: '#1f1f22',
    borderRadius: 24,
    padding: 20,
  },
  sectionLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  rowValue: {
    color: '#d4d4d8',
    fontSize: 14,
    marginBottom: 8,
  },
  helperText: {
    color: '#8f8f95',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  button: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
