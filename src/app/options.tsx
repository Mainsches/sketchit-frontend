import { AppButton } from '@/components/AppButton';
import { OptionChip } from '@/components/OptionChip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { categories, materials, stylesList } from '@/lib/mockData';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function OptionsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ imageUri?: string }>();
  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : '';

  const [category, setCategory] = useState('Chair');
  const [style, setStyle] = useState('Modern');
  const [material, setMaterial] = useState('Oak');

  const generate = () => {
    router.push({
      pathname: '/loading',
      params: {
        imageUri,
        category,
        style,
        material,
      },
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('options.title')} />
        <Text style={styles.subtitle}>{t('options.subtitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.category')}</Text>
          <View style={styles.wrap}>
            {categories.map((item) => (
              <OptionChip
                key={item}
                label={item}
                selected={item === category}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.style')}</Text>
          <View style={styles.wrap}>
            {stylesList.map((item) => (
              <OptionChip
                key={item}
                label={item}
                selected={item === style}
                onPress={() => setStyle(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.material')}</Text>
          <View style={styles.wrap}>
            {materials.map((item) => (
              <OptionChip
                key={item}
                label={item}
                selected={item === material}
                onPress={() => setMaterial(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <AppButton label={t('common.generate')} onPress={generate} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  section: {
    marginTop: 30,
    gap: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footer: {
    marginTop: 36,
  },
});