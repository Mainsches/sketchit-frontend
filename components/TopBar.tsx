import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TopBarProps = {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  showHistory?: boolean;
};

export default function TopBar({
  title,
  showBack = false,
  showSettings = false,
  showHistory = false,
}: TopBarProps) {
  const router = useRouter();

  const renderLeft = () => {
    if (showBack) {
      return (
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={22} color="#ffffff" />
        </Pressable>
      );
    }

    if (showHistory) {
      return (
        <Pressable onPress={() => router.push('/history')} style={styles.iconButton}>
          <Ionicons name="images-outline" size={19} color="#ffffff" />
        </Pressable>
      );
    }

    return <View style={styles.iconPlaceholder} />;
  };

  const renderRight = () => {
    if (showSettings) {
      return (
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
        >
          <Ionicons name="settings-outline" size={20} color="#ffffff" />
        </Pressable>
      );
    }

    return <View style={styles.iconPlaceholder} />;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrapper}>
        <View style={styles.side}>{renderLeft()}</View>

        <View style={styles.center}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>

        <View style={[styles.side, styles.sideRight]}>{renderRight()}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#000000',
  },
  wrapper: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  side: {
    width: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
});