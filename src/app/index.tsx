import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import {
  ApiError,
  GenerationRecord,
  UsageInfo,
  fetchUsage,
  getGeneration,
  startGeneration,
} from '../../services/api';
import { saveHistoryItem } from '../lib/history';
import { saveImageToGallery, shareImageFile } from '../lib/imageExport';

type GeneratePayload = {
  prompt: string;
  imageBase64: string | null;
  mimeType: string | null;
};

type Message = {
  id: string;
  role: 'user' | 'ai';
  text?: string;
  image?: string;
  canRegenerate?: boolean;
  canExport?: boolean;
  generationId?: string;
  generatePayload?: GeneratePayload;
};

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

type SheetReason = 'limit' | 'variation' | 'coming_soon';

const KEYBOARD_GAP = 48;
const POLL_INTERVAL_MS = 1800;

const PROMPT_SUGGESTIONS = [
  'Minimal white chair with metal legs',
  'Modern oak cabinet with two doors',
  'Floating shelf in dark walnut',
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [sheetReason, setSheetReason] = useState<SheetReason>('coming_soon');

  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  };

  const loadUsage = useCallback(async () => {
    try {
      const nextUsage = await fetchUsage();
      setUsage(nextUsage);
    } catch (error) {
      console.log('loadUsage error:', error);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useFocusEffect(
    useCallback(() => {
      loadUsage();
    }, [loadUsage])
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      scrollToBottom(false);
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
    if (selectedImage) {
      scrollToBottom(true);
    }
  }, [selectedImage]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  const openInfoSheet = (reason: SheetReason) => {
    setSheetReason(reason);
    setShowInfoSheet(true);
  };

  const openImageOptions = () => {
    Alert.alert('Attach sketch', 'Choose how you want to attach your sketch.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Camera', onPress: openCamera },
      { text: 'Gallery', onPress: openGallery },
    ]);
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to attach a sketch.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow gallery access to attach a sketch.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: true,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const onShareImage = async (imageUri: string) => {
    try {
      await shareImageFile(imageUri);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not share the image.');
    }
  };

  const onSaveImage = async (imageUri: string) => {
    try {
      await saveImageToGallery(imageUri);
      Alert.alert('Saved', 'The image has been saved to your gallery.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not save the image.');
    }
  };

  const pollUntilFinished = async (generationId: string): Promise<GenerationRecord> => {
    while (true) {
      const result = await getGeneration(generationId);
      const generation = result.generation;

      if (generation.status === 'done' || generation.status === 'error') {
        return generation;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  };

  const generateImage = async (payload: GeneratePayload, inputImageUri?: string) => {
    const loadingMessageId = `${Date.now()}-loading`;

    try {
      setLoading(true);

      const loadingMessage: Message = {
        id: loadingMessageId,
        role: 'ai',
        text: 'Generating image…',
      };

      setMessages((prev) => [...prev, loadingMessage]);

      const start = await startGeneration({
        prompt: payload.prompt,
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType,
        generationMode: 'balanced',
      });

      if (start.usage) {
        setUsage(start.usage);
      }

      const finalGeneration = await pollUntilFinished(start.generation.id);

      setMessages((prev) => prev.filter((item) => item.id !== loadingMessageId));

      if (finalGeneration.status !== 'done' || !finalGeneration.imageDataUrl) {
        throw new Error(finalGeneration.error?.message || 'Generation failed.');
      }

      const resultImage = finalGeneration.imageDataUrl;

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        role: 'ai',
        image: resultImage,
        canRegenerate: true,
        canExport: true,
        generationId: finalGeneration.id,
        generatePayload: payload,
      };

      setMessages((prev) => [...prev, aiMessage]);

      await saveHistoryItem({
        id: `history-${Date.now()}`,
        createdAt: Date.now(),
        prompt: payload.prompt || '',
        inputImage: inputImageUri,
        resultImage,
      });

      await loadUsage();
    } catch (error: any) {
      console.log('Generate error:', error);
      setMessages((prev) => prev.filter((item) => item.id !== loadingMessageId));

      if (error instanceof ApiError) {
        if (error.usage) {
          setUsage(error.usage);
        }

        if (error.code === 'DAILY_LIMIT_REACHED') {
          openInfoSheet('limit');
        }
      }

      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: 'ai',
        text: error?.message || 'Generation failed. Please check your connection and backend.',
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      scrollToBottom(true);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const payload: GeneratePayload = {
      prompt: input.trim(),
      imageBase64: selectedImage?.base64 || null,
      mimeType: selectedImage?.mimeType || null,
    };

    const selectedImageUri = selectedImage?.uri;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: payload.prompt || undefined,
      image: selectedImageUri,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);

    await generateImage(payload, selectedImageUri);
  };

  const onPressSuggestion = (value: string) => {
    setInput(value);
  };

  const regenerateFromMessage = async () => {
    openInfoSheet('variation');
  };

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + KEYBOARD_GAP : insets.bottom;

  const usageHeadline = useMemo(() => {
    if (!usage) {
      return 'Free plan • 2 medium images per day';
    }

    if (usage.remainingToday <= 0) {
      return 'Free limit used for today';
    }

    return `${usage.remainingToday} of ${usage.dailyLimit} free images left today`;
  }, [usage]);

  const usageSubline = useMemo(() => {
    if (!usage) {
      return 'Premium will be added later through Google Play Billing.';
    }

    if (usage.remainingToday <= 0) {
      return 'Come back tomorrow or wait for Premium in a later build.';
    }

    return 'Current mode: Medium. Variations and Premium are not active in this build.';
  }, [usage]);

  const sheetTitle =
    sheetReason === 'limit'
      ? 'Your free limit is used up'
      : sheetReason === 'variation'
      ? 'Variations are coming later'
      : 'Premium is coming later';

  const sheetSubtitle =
    sheetReason === 'limit'
      ? 'This internal build includes 2 medium images per day. Premium is not enabled yet.'
      : sheetReason === 'variation'
      ? 'Variations will be enabled later together with Google Play Billing.'
      : 'This build is focused on testing the core generation flow first.';

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isLoadingBubble = !isUser && !item.image && item.text?.includes('Generating');

    return (
      <View style={[styles.message, isUser ? styles.userMessage : styles.aiMessage]}>
        {item.image ? (
          <Pressable onPress={() => setFullscreenImage(item.image!)}>
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          </Pressable>
        ) : null}

        {item.text ? (
          <View style={styles.messageTextRow}>
            {isLoadingBubble ? (
              <ActivityIndicator size="small" color="#ffffff" style={styles.inlineLoader} />
            ) : null}
            <Text style={isUser ? styles.userText : styles.aiText}>{item.text}</Text>
          </View>
        ) : null}

        {!isUser && item.image && (item.canRegenerate || item.canExport) ? (
          <View style={styles.actionRow}>
            {item.canRegenerate ? (
              <Pressable onPress={regenerateFromMessage} style={styles.actionButton} disabled={loading}>
                <Ionicons name="sparkles-outline" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Variation</Text>
              </Pressable>
            ) : null}

            {item.canExport ? (
              <>
                <Pressable onPress={() => onShareImage(item.image!)} style={styles.actionButton}>
                  <Ionicons name="share-outline" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </Pressable>

                <Pressable onPress={() => onSaveImage(item.image!)} style={styles.actionButton}>
                  <Ionicons name="download-outline" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Save</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
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
          paddingBottom: 210,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollToBottom(false)}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Sketch to image</Text>
              <Text style={styles.heroSubtitle}>Attach a sketch, write a short prompt, generate a realistic result.</Text>
            </View>

            <View style={[styles.limitCard, usage?.remainingToday === 0 && styles.limitCardMuted]}>
              <View style={styles.limitHeaderRow}>
                <View style={styles.limitBadge}>
                  <Ionicons name="flash-outline" size={14} color="#000000" />
                  <Text style={styles.limitBadgeText}>Medium</Text>
                </View>
                <Text style={styles.limitPill}>Free</Text>
              </View>
              <Text style={styles.limitTitle}>{usageHeadline}</Text>
              <Text style={styles.limitSubtitle}>{usageSubline}</Text>
            </View>

            {messages.length === 0 ? (
              <View style={styles.tipsSection}>
                <Text style={styles.tipsLabel}>Quick ideas</Text>
                <View style={styles.tipList}>
                  {PROMPT_SUGGESTIONS.map((item) => (
                    <Pressable key={item} style={styles.tipChip} onPress={() => onPressSuggestion(item)}>
                      <Text style={styles.tipChipText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        }
      />

      {selectedImage ? (
        <View style={[styles.previewRow, { bottom: bottomOffset + 88 }]}> 
          <Pressable onPress={() => setFullscreenImage(selectedImage.uri)}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
          </Pressable>

          <View style={styles.previewTextWrap}>
            <Text style={styles.previewTitle}>Sketch attached</Text>
            <Text style={styles.previewSubtitle}>It will be sent with your prompt.</Text>
          </View>

          <Pressable onPress={() => setSelectedImage(null)} style={styles.previewClose}>
            <Ionicons name="close" size={18} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputRow, { bottom: bottomOffset }]}> 
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
        />

        <Pressable onPress={sendMessage} style={[styles.sendButton, loading && styles.sendButtonDisabled]} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#000000" />
          )}
        </Pressable>
      </View>

      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseButton} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          <View style={styles.modalContent}>
            {fullscreenImage ? (
              <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInfoSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfoSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowInfoSheet(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            <Text style={styles.sheetSubtitle}>{sheetSubtitle}</Text>
            <Pressable style={styles.sheetPrimaryButton} onPress={() => setShowInfoSheet(false)}>
              <Text style={styles.sheetPrimaryButtonText}>OK</Text>
            </Pressable>
          </View>
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
  heroCard: {
    backgroundColor: '#0b0b0c',
    borderWidth: 1,
    borderColor: '#1f1f22',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
  },
  limitCard: {
    backgroundColor: '#101012',
    borderWidth: 1,
    borderColor: '#232327',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  limitCardMuted: {
    borderColor: '#39393f',
  },
  limitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  limitBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  limitPill: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  limitTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  limitSubtitle: {
    color: '#8f8f95',
    fontSize: 13,
    lineHeight: 20,
  },
  tipsSection: {
    marginBottom: 10,
  },
  tipsLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tipChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#0f0f10',
    borderWidth: 1,
    borderColor: '#1d1d1f',
  },
  tipChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    maxWidth: '88%',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#ffffff',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f0f10',
    borderWidth: 1,
    borderColor: '#1d1d1f',
  },
  userText: {
    color: '#000000',
    fontSize: 15,
    lineHeight: 21,
  },
  aiText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineLoader: {
    marginRight: 10,
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 14,
    backgroundColor: '#111111',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  previewRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#0f0f10',
    borderWidth: 1,
    borderColor: '#202024',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  previewTextWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: '#8f8f95',
    fontSize: 12,
    marginTop: 2,
  },
  previewClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    marginHorizontal: 10,
    maxHeight: 120,
    fontSize: 15,
    paddingVertical: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#0b0b0c',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#1f1f22',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2b2b2f',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  sheetSubtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  sheetPrimaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
