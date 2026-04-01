import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import {
  createVariation,
  GenerationMode,
  GenerationRecord,
  getOrCreateSessionId,
  pollGenerationUntilFinished,
  startGeneration,
} from '../../services/api';
import { saveHistoryItem } from '../lib/history';
import { saveImageToGallery, shareImageFile } from '../lib/imageExport';

type GeneratePayload = {
  prompt: string;
  imageBase64: string | null;
  mimeType: string | null;
  generationMode: GenerationMode;
};

type Message = {
  id: string;
  role: 'user' | 'ai';
  text?: string;
  image?: string;
  status?: 'loading' | 'done' | 'error';
  canRegenerate?: boolean;
  canExport?: boolean;
  generatePayload?: GeneratePayload;
  generationId?: string;
  sessionId?: string;
  sourceGenerationId?: string | null;
  type?: 'base' | 'variation' | string;
  generationMode?: GenerationMode;
};

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

type UiSettings = {
  autoSave: boolean;
  haptics: boolean;
  defaultGenerationMode: GenerationMode;
};

const KEYBOARD_GAP = 48;
const SETTINGS_KEY = 'sketchit_ui_settings_v1';
const PROMPT_SUGGESTIONS = [
  'Modern black chair with metal legs',
  'Minimal wooden side table, studio photo',
  'Clean shelf design from my sketch',
  'Premium desk lamp, realistic product render',
];
const MODE_OPTIONS: { key: GenerationMode; label: string; shortLabel: string }[] = [
  { key: 'fast', label: 'Fast', shortLabel: 'Fast' },
  { key: 'balanced', label: 'Medium', shortLabel: 'Medium' },
  { key: 'premium', label: 'Premium', shortLabel: 'Premium' },
];
const defaultSettings: UiSettings = {
  autoSave: true,
  haptics: true,
  defaultGenerationMode: 'balanced',
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [settings, setSettings] = useState<UiSettings>(defaultSettings);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('balanced');

  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getOrCreateSessionId().catch((error) => {
      console.log('Session init error:', error);
    });
    loadSettings();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages, pendingCount]);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        setGenerationMode(defaultSettings.defaultGenerationMode);
        return;
      }

      const parsed = { ...defaultSettings, ...JSON.parse(raw) } as UiSettings;
      setSettings(parsed);
      setGenerationMode(parsed.defaultGenerationMode || 'balanced');
    } catch {
      setGenerationMode(defaultSettings.defaultGenerationMode);
    }
  };

  const buildDataUri = (base64: string) => `data:image/png;base64,${base64}`;

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const replaceMessage = (messageId: string, nextMessage: Message) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? nextMessage : message))
    );
  };

  const runHaptic = async (
    type: 'soft' | 'success' | 'error' = 'soft'
  ) => {
    if (!settings.haptics) return;

    try {
      if (type === 'soft') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // ignore
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow gallery access so you can attach a sketch.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        if (!asset.base64) {
          Alert.alert('Error', 'The selected image could not be read.');
          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });

        await runHaptic('soft');
      }
    } catch {
      Alert.alert('Error', 'The image could not be selected.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow camera access so you can take a sketch photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        if (!asset.base64) {
          Alert.alert('Error', 'The photo could not be read.');
          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });

        await runHaptic('soft');
      }
    } catch {
      Alert.alert('Error', 'The photo could not be taken.');
    }
  };

  const openImageOptions = () => {
    Alert.alert('Add sketch', 'Choose an option', [
      {
        text: 'Take photo',
        onPress: takePhoto,
      },
      {
        text: 'Upload image',
        onPress: pickFromGallery,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const onShareImage = async (imageUri: string) => {
    try {
      await shareImageFile(imageUri);
      await runHaptic('soft');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'The image could not be shared.');
    }
  };

  const onSaveImage = async (imageUri: string) => {
    try {
      await saveImageToGallery(imageUri);
      await runHaptic('success');
      Alert.alert('Saved', 'The image was saved to your gallery.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'The image could not be saved.');
    }
  };

  const buildSuccessMessage = (
    generation: GenerationRecord,
    payload: GeneratePayload
  ): Message => {
    const imageUri = generation.imageDataUrl || buildDataUri(generation.imageBase64 || '');

    return {
      id: generation.id,
      role: 'ai',
      status: 'done',
      text:
        generation.type === 'variation'
          ? 'Here is a fresh alternative. Same idea, different direction.'
          : 'Here is your generated concept.',
      image: imageUri,
      canRegenerate: true,
      canExport: true,
      generatePayload: payload,
      generationId: generation.id,
      sessionId: generation.sessionId,
      sourceGenerationId: generation.sourceGenerationId || null,
      type: generation.type,
      generationMode: generation.generationMode || payload.generationMode,
    };
  };

  const maybeAutoSaveToHistory = async (
    successMessage: Message,
    prompt: string,
    inputImageUri: string | undefined,
    finished: GenerationRecord
  ) => {
    if (!settings.autoSave || !successMessage.image) {
      return;
    }

    await saveHistoryItem({
      id: `history-${Date.now()}`,
      createdAt: Date.now(),
      prompt,
      inputImage: inputImageUri,
      resultImage: successMessage.image,
      generationId: finished.id,
      sessionId: finished.sessionId,
      sourceGenerationId: finished.sourceGenerationId || null,
      type: finished.type,
      generationMode: finished.generationMode || generationMode,
    });
  };

  const runBaseGeneration = async (
    payload: GeneratePayload,
    inputImageUri?: string
  ) => {
    const loadingId = `loading-${Date.now()}`;

    addMessage({
      id: loadingId,
      role: 'ai',
      status: 'loading',
      text: payload.imageBase64
        ? `Reading your sketch and generating a realistic concept in ${getModeLabel(payload.generationMode)} mode…`
        : `Generating your concept in ${getModeLabel(payload.generationMode)} mode…`,
      generatePayload: payload,
      generationMode: payload.generationMode,
    });

    setPendingCount((prev) => prev + 1);
    await runHaptic('soft');

    try {
      const started = await startGeneration({
        prompt: payload.prompt || 'Generate a realistic image based on this sketch.',
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType,
        generationMode: payload.generationMode,
      });

      const finished = await pollGenerationUntilFinished(started.generation.id);
      const successMessage = buildSuccessMessage(finished, payload);

      replaceMessage(loadingId, successMessage);
      await runHaptic('success');
      await maybeAutoSaveToHistory(successMessage, payload.prompt || '', inputImageUri, finished);
    } catch (error: any) {
      await runHaptic('error');
      replaceMessage(loadingId, {
        id: `error-${Date.now()}`,
        role: 'ai',
        status: 'error',
        text:
          error?.message ||
          'Generation failed. Please check your server, network, or Render deployment.',
      });
    } finally {
      setPendingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const runVariationGeneration = async (message: Message) => {
    if (!message.generationId || !message.generatePayload) {
      return;
    }

    const loadingId = `variation-loading-${Date.now()}`;
    const nextMode = message.generatePayload.generationMode || generationMode;

    addMessage({
      id: loadingId,
      role: 'ai',
      status: 'loading',
      text: `Creating a more distinct alternative in ${getModeLabel(nextMode)} mode…`,
      generatePayload: {
        ...message.generatePayload,
        generationMode: nextMode,
      },
      sourceGenerationId: message.generationId,
      type: 'variation',
      generationMode: nextMode,
    });

    setPendingCount((prev) => prev + 1);
    await runHaptic('soft');

    try {
      const started = await createVariation(message.generationId, {
        prompt: message.generatePayload.prompt,
        variationIntent: 'alternate',
        generationMode: nextMode,
      });

      const finished = await pollGenerationUntilFinished(started.generation.id);
      const successMessage = buildSuccessMessage(finished, {
        ...message.generatePayload,
        generationMode: nextMode,
      });

      replaceMessage(loadingId, successMessage);
      await runHaptic('success');
      await maybeAutoSaveToHistory(
        successMessage,
        message.generatePayload.prompt || '',
        undefined,
        finished
      );
    } catch (error: any) {
      await runHaptic('error');
      replaceMessage(loadingId, {
        id: `error-${Date.now()}`,
        role: 'ai',
        status: 'error',
        text: error?.message || 'The alternative could not be generated.',
      });
    } finally {
      setPendingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || pendingCount > 0) return;

    const payload: GeneratePayload = {
      prompt: input.trim(),
      imageBase64: selectedImage?.base64 || null,
      mimeType: selectedImage?.mimeType || null,
      generationMode,
    };

    const selectedImageUri = selectedImage?.uri;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      status: 'done',
      text: payload.prompt || undefined,
      image: selectedImageUri,
      generationMode,
    };

    addMessage(userMessage);
    setHeroDismissed(true);
    setInput('');
    setSelectedImage(null);

    await runBaseGeneration(payload, selectedImageUri);
  };

  const regenerateFromMessage = async (message: Message) => {
    if (pendingCount > 0) return;
    await runVariationGeneration(message);
  };

  const applySuggestion = (value: string) => {
    setInput(value);
    setHeroDismissed(true);
  };

  const getHelperText = () => {
    if (pendingCount > 0) return 'Generating…';
    if (generationMode === 'fast') return 'Fast mode · lower cost';
    if (generationMode === 'premium') return 'Premium mode · richer output';
    return 'Medium mode · recommended';
  };

  const bottomOffset =
    keyboardHeight > 0 ? keyboardHeight + KEYBOARD_GAP : insets.bottom;

  const showHero = useMemo(
    () => messages.length === 0 && !heroDismissed,
    [heroDismissed, messages.length]
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isLoading = item.status === 'loading';
    const isError = item.status === 'error';

    return (
      <View style={styles.messageBlock}>
        {!isUser ? (
          <View style={styles.messageMetaRow}>
            <View style={styles.metaBadge}>
              <View
                style={[
                  styles.metaDot,
                  isError ? styles.metaDotError : isLoading ? styles.metaDotLoading : styles.metaDotDone,
                ]}
              />
              <Text style={styles.metaBadgeText}>
                {isError
                  ? 'Error'
                  : isLoading
                    ? 'Generating'
                    : item.type === 'variation'
                      ? 'Alternative'
                      : 'Result'}
              </Text>
            </View>

            {!isLoading && !isError && item.generationMode ? (
              <View style={styles.modeBadgeCompact}>
                <Text style={styles.modeBadgeCompactText}>{getModeLabel(item.generationMode)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.message,
            isUser ? styles.userMessage : styles.aiMessage,
            isError ? styles.errorMessage : null,
          ]}
        >
          {item.image ? (
            <Pressable onPress={() => setFullscreenImage(item.image!)}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </Pressable>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.aiText}>{item.text || 'Generating…'}</Text>
              </View>

              <View style={styles.loadingProgressTrack}>
                <View style={styles.loadingProgressFill} />
              </View>
            </View>
          ) : item.text ? (
            <Text style={isUser ? styles.userText : styles.aiText}>{item.text}</Text>
          ) : null}

          {!isUser && item.image && item.status === 'done' && (item.canRegenerate || item.canExport) ? (
            <View style={styles.actionRow}>
              {item.canRegenerate ? (
                <Pressable
                  onPress={() => regenerateFromMessage(item)}
                  style={[styles.actionButton, pendingCount > 0 && styles.actionButtonDisabled]}
                  disabled={pendingCount > 0}
                >
                  <Ionicons name="sparkles-outline" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Alternative</Text>
                </Pressable>
              ) : null}

              {item.canExport ? (
                <>
                  <Pressable
                    onPress={() => onShareImage(item.image!)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="share-outline" size={16} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => onSaveImage(item.image!)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="download-outline" size={16} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Save</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar title="SketchIT" showHistory showSettings />

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 230,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          showHero ? (
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="sparkles" size={18} color="#ffffff" />
              </View>
              <Text style={styles.heroTitle}>Sketch to image</Text>
              <Text style={styles.heroText}>
                Upload a sketch or just describe your idea. Medium mode is now the best default for strong quality without unnecessary cost.
              </Text>

              <View style={styles.heroSuggestionWrap}>
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    style={styles.suggestionChip}
                    onPress={() => applySuggestion(suggestion)}
                  >
                    <Text style={styles.suggestionChipText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !showHero ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Start creating</Text>
              <Text style={styles.emptyText}>
                Add a sketch and describe what you want to generate.
              </Text>
            </View>
          ) : null
        }
      />

      {selectedImage ? (
        <View style={[styles.previewRow, { bottom: bottomOffset + 120 }]}> 
          <Pressable onPress={() => setFullscreenImage(selectedImage.uri)}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
          </Pressable>

          <View style={styles.previewTextWrap}>
            <Text style={styles.previewTitle}>Sketch attached</Text>
            <Text style={styles.previewSubtitle}>
              Your image will be sent together with the prompt.
            </Text>
          </View>

          <Pressable
            onPress={() => setSelectedImage(null)}
            style={styles.previewClose}
          >
            <Ionicons name="close" size={18} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputShell, { bottom: bottomOffset }]}> 
        <View style={styles.inputTopRow}>
          <View style={styles.helperPill}>
            <Ionicons name="flash-outline" size={14} color="#d4d4d8" />
            <Text style={styles.helperPillText}>{getHelperText()}</Text>
          </View>
        </View>

        <View style={styles.modeSelectorRow}>
          {MODE_OPTIONS.map((mode) => {
            const active = generationMode === mode.key;

            return (
              <Pressable
                key={mode.key}
                onPress={() => setGenerationMode(mode.key)}
                style={[styles.modeChip, active && styles.modeChipActive]}
                disabled={pendingCount > 0}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputRow}>
          <Pressable onPress={openImageOptions} style={styles.plusButton}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </Pressable>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe your sketch..."
            placeholderTextColor="#666666"
            style={styles.input}
            multiline
            editable={pendingCount === 0}
          />

          <Pressable
            onPress={sendMessage}
            style={[
              styles.sendButton,
              ((!input.trim() && !selectedImage) || pendingCount > 0) && styles.sendButtonDisabled,
            ]}
            disabled={(!input.trim() && !selectedImage) || pendingCount > 0}
          >
            {pendingCount > 0 ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#000000" />
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalClose}
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function getModeLabel(mode: GenerationMode) {
  if (mode === 'fast') return 'Fast';
  if (mode === 'premium') return 'Premium';
  return 'Medium';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  heroCard: {
    backgroundColor: '#0c0c0e',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 18,
    marginBottom: 18,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141416',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
  },
  heroSuggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#222226',
  },
  suggestionChipText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 96,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  messageBlock: {
    gap: 6,
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0e0e10',
    borderWidth: 1,
    borderColor: '#1b1b1f',
  },
  metaDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  metaDotLoading: {
    backgroundColor: '#facc15',
  },
  metaDotDone: {
    backgroundColor: '#22c55e',
  },
  metaDotError: {
    backgroundColor: '#ef4444',
  },
  metaBadgeText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f1f23',
    backgroundColor: '#0e0e10',
  },
  modeBadgeCompactText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    maxWidth: '92%',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#0d0d0f',
    borderColor: '#1f1f23',
  },
  errorMessage: {
    borderColor: '#4b1d1d',
    backgroundColor: '#120909',
  },
  userText: {
    color: '#000000',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  aiText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: '#161616',
  },
  loadingWrap: {
    gap: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1a1a1f',
    overflow: 'hidden',
  },
  loadingProgressFill: {
    width: '62%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#2a2a31',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  previewRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0b0b0d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 12,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#161616',
  },
  previewTextWrap: {
    flex: 1,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
  },
  previewClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#24242a',
  },
  inputShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#0b0b0d',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 12,
    gap: 10,
  },
  inputTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  helperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#1f1f23',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  helperPillText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#1f1f23',
    paddingHorizontal: 12,
  },
  modeChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  modeChipText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#000000',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#24242a',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#131316',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  fullscreenImage: {
    width: '100%',
    height: '78%',
  },
});
