import { AppButton } from '@/components/AppButton';
import { InfoRow } from '@/components/InfoRow';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

export default function ResultScreen() {
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

  const handleSave = async () => {
    if (!imageUri) {
      Alert.alert(t('common.error'), t('result.noImage'));
      return;
    }

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('common.permissionRequired'), t('result.mediaPermission'));
      return;
    }

    await MediaLibrary.saveToLibraryAsync(imageUri);
    Alert.alert(t('result.savedTitle'), t('result.savedText'));
  };

  const handleShare = async () => {
    if (!imageUri) {
      Alert.alert(t('common.error'), t('result.noImage'));
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert(t('common.error'), t('result.shareUnavailable'));
      return;
    }

    await Sharing.shareAsync(imageUri);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <TopBar title="SketchIT" showBack showSettings={false} />

        <Text style={styles.title}>{t('result.title')}</Text>

        <View style={styles.imageBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.emptyImage}>
              <Text style={styles.emptyText}>{t('result.noPreview')}</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('result.badge')}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <InfoRow label={t('common.category')} value={category} />
          <InfoRow label={t('common.style')} value={style} />
          <InfoRow label={t('common.material')} value={material} />
        </View>

        <View style={styles.actions}>
          <AppButton label={t('common.save')} variant="secondary" onPress={handleSave} />
          <View style={{ height: 10 }} />
          <AppButton label={t('common.share')} variant="secondary" onPress={handleShare} />
          <View style={{ height: 10 }} />
          <AppButton label={t('result.generateAgain')} onPress={() => router.replace('/upload')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  imageBox: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 360,
  },
  emptyImage: {
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSoft,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  infoBox: {
    marginTop: 18,
    borderRadius: 22,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    marginTop: 20,
  },
});