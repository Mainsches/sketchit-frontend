import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import TopBar from '../../components/TopBar';

const MOCK_IMAGE_URI =
  'https://dummyimage.com/1200x900/111111/ffffff.png&text=SketchIT+Mock+Sketch';

export default function UploadScreen() {
  const router = useRouter();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const hasImage = useMemo(() => !!selectedImageUri, [selectedImageUri]);

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission required',
          'Please allow access to your photos to choose an image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'The image could not be selected.');
    }
  };

  const simulatePhoto = () => {
    setSelectedImageUri(MOCK_IMAGE_URI);
  };

  const clearImage = () => {
    setSelectedImageUri(null);
  };

  const goNext = () => {
    if (!selectedImageUri) {
      Alert.alert('No image selected', 'Please choose or simulate a sketch first.');
      return;
    }

    router.push({
      pathname: '/options',
      params: {
        imageUri: selectedImageUri,
      },
    });
  };

  return (
    <View style={styles.container}>
      <TopBar title="Upload" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.headline}>Add your sketch</Text>
          <Text style={styles.subheadline}>
            Choose a real image from your gallery or use a mock sketch to test the flow.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.sectionLabel}>Preview</Text>

          <View style={styles.previewBox}>
            {hasImage ? (
              <Image source={{ uri: selectedImageUri! }} style={styles.previewImage} />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="image-outline" size={38} color="#6b7280" />
                <Text style={styles.emptyTitle}>No sketch selected</Text>
                <Text style={styles.emptyText}>
                  Pick an image or simulate one to continue.
                </Text>
              </View>
            )}
          </View>

          {hasImage ? (
            <Pressable
              onPress={clearImage}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.clearButtonText}>Remove image</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.sectionLabel}>Actions</Text>

          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="images-outline" size={20} color="#000000" />
            <Text style={styles.primaryButtonText}>Choose Image</Text>
          </Pressable>

          <Pressable
            onPress={simulatePhoto}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="camera-outline" size={20} color="#ffffff" />
            <Text style={styles.secondaryButtonText}>Simulate Photo</Text>
          </Pressable>
        </View>

        <View style={styles.nextWrapper}>
          <Pressable
            onPress={goNext}
            style={({ pressed }) => [
              styles.nextButton,
              !hasImage && styles.nextButtonDisabled,
              pressed && hasImage && styles.buttonPressed,
            ]}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 18,
  },
  intro: {
    gap: 10,
  },
  headline: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subheadline: {
    color: '#a1a1aa',
    fontSize: 15,
    lineHeight: 22,
  },
  previewCard: {
    backgroundColor: '#0b0b0b',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    padding: 16,
    gap: 14,
  },
  actionCard: {
    backgroundColor: '#0b0b0b',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  previewBox: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  clearButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  nextWrapper: {
    paddingTop: 8,
  },
  nextButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nextButtonDisabled: {
    opacity: 0.45,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});