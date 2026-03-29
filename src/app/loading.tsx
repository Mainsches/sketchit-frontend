import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { loadingMessages } from '@/lib/mockData';
import { addHistoryItem } from '@/lib/storage';
import { colors } from '@/theme/colors';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    imageUri?: string;
    category?: string;
    style?: string;
    material?: string;
  }>();

  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : '';
  const category = typeof params.category === 'string' ? params.category : 'Chair';
  const style = typeof params.style === 'string' ? params.style : 'Modern';
  const material = typeof params.material === 'string' ? params.material : 'Oak';

  const [step, setStep] = useState(0);
  const message = useMemo(() => loadingMessages[step % loadingMessages.length], [step]);

  useEffect(() => {
    const msgTimer = setInterval(() => setStep((prev) => prev + 1), 1100);

    const timer = setTimeout(async () => {
      const item = {
        id: Date.now().toString(),
        imageUri,
        category,
        style,
        material,
        createdAt: new Date().toISOString(),
      };

      await addHistoryItem(item);

      router.replace({
        pathname: '/result',
        params: {
          imageUri,
          category,
          style,
          material,
        },
      });
    }, 3000);

    return () => {
      clearInterval(msgTimer);
      clearTimeout(timer);
    };
  }, [category, imageUri, material, style]);

  return (
    <Screen>
      <View style={styles.container}>
        <TopBar title="SketchIT" showBack={false} showSettings={false} />

        <View style={styles.box}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.title}>{message}</Text>
          <Text style={styles.subtitle}>{t('loading.subtitle')}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  box: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});