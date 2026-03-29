import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../lib/i18n';

type AppHeaderProps = {
  title: string;
  backTo?: string;
};

export default function AppHeader({ title, backTo }: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (backTo) {
      router.replace(backTo as any);
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftWrap}>
        {backTo ? (
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleBack}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
            <Text style={styles.backText}>{t('back')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.rightSpacer} />
    </View>
  );
}

const LEFT_WIDTH = 132;
const RIGHT_WIDTH = 20;
const HEADER_HEIGHT = 56;

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  leftWrap: {
    width: LEFT_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 10,
    paddingRight: 8,
  },
  rightSpacer: {
    width: RIGHT_WIDTH,
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  backText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
});