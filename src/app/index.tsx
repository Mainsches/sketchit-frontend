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
  ApiError,
  createVariation,
  fetchUsage,
  GenerationMode,
  GenerationRecord,
  getOrCreateSessionId,
  pollGenerationUntilFinished,
  startGeneration,
  UsageInfo,
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
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    initializeScreen();
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

  const initializeScreen = async () => {
    try {
      await getOrCreateSessionId();
      await loadSettings();
      await refreshUsage();
    } catch (error) {
      console.log('Init error:', error);
    } finally {
      setUsageLoading(false);
    }
  };

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

  const refreshUsage = async () => {
    try {
      const sessionId = await getOrCreateSessionId();
      const nextUsage = await fetchUsage(sessionId);
      setUsage(nextUsage);
      return nextUsage;
    } catch (error) {
      console.log('Usage refresh error:', error);
      return null;
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

  const showUpgradeAlert = (message?: string) => {
    Alert.alert(
      'Upgrade to Premium',
      message || 'Premium unlocks more daily generations, premium mode, and variations.'
    );
  };

  const handleApiError = async (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.usage) {
        setUsage(error.usage);
      } else {
        await refreshUsage();
      }

      if (error.code === 'DAILY_LIMIT_REACHED') {
        showUpgradeAlert(error.message);
        return error.message;
      }

      if (
        error.code === 'PREMIUM_MODE_REQUIRED' ||
        error.code === 'PREMIUM_VARIATION_REQUIRED'
      ) {
        showUpgradeAlert(error.message);
        return error.message;
      }

      return error.message;
    }

    return error instanceof Error ? error.message : 'Unknown error';
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
      const sessionId = await getOrCreateSessionId();
      const started = await startGeneration({
        prompt: payload.prompt || 'Generate a realistic image based on this sketch.',
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType,
        generationMode: payload.generationMode,
        sessionId,
      });

      if (started.usage) {
        setUsage(started.usage);
      }

      const finished = await pollGenerationUntilFinished(started.generation.id);
      const successMessage = buildSuccessMessage(finished, payload);

      replaceMessage(loadingId, successMessage);
      await runHaptic('success');
      await maybeAutoSaveToHistory(successMessage, payload.prompt || '', inputImageUri, finished);
      await refreshUsage();
    } catch (error) {
      await runHaptic('error');
      const message = await handleApiError(error);
      replaceMessage(loadingId, {
        id: `error-${Date.now()}`,
        role: 'ai',
        status: 'error',
        text: message || 'Generation failed. Please check your server, network, or Render deployment.',
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

      if (started.usage) {
        setUsage(started.usage);
      }

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
      await refreshUsage();
    } catch (error) {
      await runHaptic('error');
      const text = await handleApiError(error);
      replaceMessage(loadingId, {
        id: `error-${Date.now()}`,
        role: 'ai',
        status: 'error',
        text: text || 'The alternative could not be generated.',
      });
    } finally {
      setPendingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || pendingCount > 0) return;

    if (generationMode === 'premium' && !usage?.isPremium) {
      showUpgradeAlert('Premium mode is only available for premium users.');
      return;
    }

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
    if (generationMode === 'premium') return 'Premium mode · best reserved for paid users';
    return 'Medium mode · recommended';
  };

  const getModeLabel = (mode?: GenerationMode) => {
    if (mode === 'fast') return 'Fast';
    if (mode === 'premium') return 'Premium';
    return 'Medium';
  };

  const bottomOffset =
    keyboardHeight > 0 ? keyboardHeight + KEYBOARD_GAP : insets.bottom;

  const showHero = useMemo(
    () => messages.length === 0 && !heroDismissed,
    [heroDismissed, messages.length]
  );

  const renderUsageCard = () => {
    if (usageLoading && !usage) {
      return (
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Loading plan…</Text>
        </View>
      );
    }

    if (!usage) {
      return null;
    }

    return (
      <View style={styles.usageCard}>
        <View style={styles.usageTopRow}>
          <View>
            <Text style={styles.usageTitle}>{usage.isPremium ? 'Premium plan' : 'Free plan'}</Text>
            <Text style={styles.usageSubtitle}>
              {usage.isPremium
                ? `${usage.remainingToday} of ${usage.dailyLimit} images left today`
                : `${usage.remainingToday} of ${usage.dailyLimit} free images left today`}
            </Text>
          </View>
          <Text style={[styles.planBadge, usage.isPremium && styles.planBadgePremium]}>
            {usage.isPremium ? 'Premium' : 'Free'}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, (usage.dailyCount / Math.max(usage.dailyLimit, 1)) * 100)}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.usageFootnote}>
          {usage.isPremium
            ? 'Variations and Premium mode are unlocked.'
            : 'Upgrade later for more daily images, Premium mode and variations.'}
        </Text>
      </View>
    );
  };

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
                {isError ? 'SketchIT error' : isLoading ? 'SketchIT generating' : 'SketchIT'}
              </Text>
            </View>
            {item.generationMode ? (
              <View style={styles.modeBadgeSmall}>
                <Text style={styles.modeBadgeSmallText}>{getModeLabel(item.generationMode)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble, isError && styles.errorBubble]}>
          {item.text ? <Text style={[styles.messageText, isUser && styles.userMessageText]}>{item.text}</Text> : null}

          {item.image ? (
            <Pressable onPress={() => setFullscreenImage(item.image!)} style={styles.imageWrap}>
              <Image source={{ uri: item.image }} style={styles.resultImage} resizeMode="cover" />
            </Pressable>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.loadingText}>Please wait…</Text>
            </View>
          ) : null}
        </View>

        {!isUser && item.status === 'done' && item.image ? (
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={() => onSaveImage(item.image!)}>
              <Ionicons name="download-outline" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Save</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => onShareImage(item.image!)}>
              <Ionicons name="share-social-outline" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Share</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => regenerateFromMessage(item)}>
              <Ionicons name="sparkles-outline" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Variation</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar title="SketchIT" />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 220 + bottomOffset },
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {renderUsageCard()}

            {showHero ? (
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>Sketch to image</Text>
                <Text style={styles.heroTitle}>Turn rough ideas into realistic product visuals.</Text>
                <Text style={styles.heroSubtitle}>
                  Start with text only or add a quick sketch. Free users get 2 Medium images per day. Premium later unlocks more images, Premium mode and variations.
                </Text>

                <View style={styles.suggestionWrap}>
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
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.composerWrap, { paddingBottom: bottomOffset + 12 }]}> 
        {selectedImage ? (
          <View style={styles.attachmentCard}>
            <Image source={{ uri: selectedImage.uri }} style={styles.attachmentPreview} />
            <View style={styles.attachmentTextWrap}>
              <Text style={styles.attachmentTitle}>Sketch attached</Text>
              <Text style={styles.attachmentSubtitle}>Your image will be used as structural input.</Text>
            </View>
            <Pressable onPress={() => setSelectedImage(null)} style={styles.attachmentClose}>
              <Ionicons name="close" size={18} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((mode) => {
            const active = generationMode === mode.key;
            const blocked = mode.key === 'premium' && !usage?.isPremium;

            return (
              <Pressable
                key={mode.key}
                style={[styles.modeChip, active && styles.modeChipActive, blocked && styles.modeChipBlocked]}
                onPress={() => {
                  if (blocked) {
                    showUpgradeAlert('Premium mode is locked on the free plan.');
                    return;
                  }
                  setGenerationMode(mode.key);
                }}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.shortLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Describe your idea or upload a sketch…"
            placeholderTextColor="#6b7280"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <View style={styles.inputFooterRow}>
            <Pressable style={styles.iconButton} onPress={openImageOptions}>
              <Ionicons name="image-outline" size={18} color="#ffffff" />
            </Pressable>

            <Text style={styles.helperText}>{getHelperText()}</Text>

            <Pressable
              style={[styles.sendButton, ((!input.trim() && !selectedImage) || pendingCount > 0) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={(!input.trim() && !selectedImage) || pendingCount > 0}
            >
              <Ionicons name="arrow-up" size={18} color="#000000" />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={Boolean(fullscreenImage)} transparent animationType="fade">
        <View style={styles.fullscreenBackdrop}>
          <Pressable style={styles.fullscreenClose} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          {fullscreenImage ? (
            <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  listHeader: {
    gap: 14,
    marginBottom: 10,
  },
  usageCard: {
    backgroundColor: '#0b0b0d',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 18,
  },
  usageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  usageTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  usageSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 4,
  },
  planBadge: {
    color: '#d4d4d8',
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#26262b',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
  },
  planBadgePremium: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderColor: '#ffffff',
  },
  progressTrack: {
    marginTop: 14,
    height: 8,
    backgroundColor: '#1a1a1f',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 999,
  },
  usageFootnote: {
    marginTop: 10,
    color: '#7c7c86',
    fontSize: 12,
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: '#0b0b0d',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 20,
  },
  heroEyebrow: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 10,
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
  },
  suggestionWrap: {
    marginTop: 16,
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: '#111113',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#24242a',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionChipText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  messageBlock: {
    gap: 8,
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  metaDotLoading: {
    backgroundColor: '#f59e0b',
  },
  metaDotDone: {
    backgroundColor: '#22c55e',
  },
  metaDotError: {
    backgroundColor: '#ef4444',
  },
  metaBadgeText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBadgeSmall: {
    borderRadius: 999,
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#24242a',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeBadgeSmallText: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '700',
  },
  messageBubble: {
    borderRadius: 24,
    padding: 16,
  },
  aiBubble: {
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: '#1f1f23',
  },
  userBubble: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  errorBubble: {
    borderColor: '#3b1111',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#000000',
  },
  imageWrap: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#111113',
  },
  loadingRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#24242a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  composerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: '#1f1f23',
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
  },
  attachmentPreview: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#111113',
  },
  attachmentTextWrap: {
    flex: 1,
  },
  attachmentTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  attachmentClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16161a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    flex: 1,
    backgroundColor: '#0f0f12',
    borderColor: '#1f1f23',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  modeChipBlocked: {
    opacity: 0.45,
  },
  modeChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#000000',
  },
  inputCard: {
    backgroundColor: '#0b0b0d',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1f1f23',
    padding: 14,
  },
  input: {
    minHeight: 72,
    maxHeight: 150,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  inputFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16161a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    flex: 1,
    color: '#8b8b95',
    fontSize: 12,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  fullscreenImage: {
    width: '92%',
    height: '72%',
  },
});
