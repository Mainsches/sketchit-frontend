import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
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
  generatePayload?: GeneratePayload;
};

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

const KEYBOARD_GAP = 48;
const API_URL = 'https://sketchit-backend-plov.onrender.com/generate';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

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
  }, [messages, loading]);

  const pickFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Berechtigung nötig',
          'Bitte erlaube den Zugriff auf deine Galerie.'
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
          Alert.alert('Fehler', 'Das Bild konnte nicht gelesen werden.');
          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      Alert.alert('Fehler', 'Das Bild konnte nicht ausgewählt werden.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Berechtigung nötig',
          'Bitte erlaube den Zugriff auf die Kamera.'
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
          Alert.alert('Fehler', 'Das Foto konnte nicht gelesen werden.');
          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      Alert.alert('Fehler', 'Das Foto konnte nicht aufgenommen werden.');
    }
  };

  const openImageOptions = () => {
    Alert.alert('Bild hinzufügen', 'Wähle eine Option', [
      {
        text: 'Foto aufnehmen',
        onPress: takePhoto,
      },
      {
        text: 'Foto hochladen',
        onPress: pickFromGallery,
      },
      {
        text: 'Abbrechen',
        style: 'cancel',
      },
    ]);
  };

  const buildDataUri = (base64: string) => `data:image/png;base64,${base64}`;

  const onShareImage = async (imageUri: string) => {
    try {
      await shareImageFile(imageUri);
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Das Bild konnte nicht geteilt werden.');
    }
  };

  const onSaveImage = async (imageUri: string) => {
    try {
      await saveImageToGallery(imageUri);
      Alert.alert('Gespeichert', 'Das Bild wurde in deiner Galerie gespeichert.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Das Bild konnte nicht gespeichert werden.');
    }
  };

  const generateImage = async (
    payload: GeneratePayload,
    inputImageUri?: string
  ) => {
    if (!payload.prompt.trim() && !payload.imageBase64) return;

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt:
            payload.prompt || 'Generate a realistic image based on this sketch.',
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error('Ungültige Server-Antwort');
      }

      if (!response.ok) {
        console.log('Backend error response:', data);
        throw new Error(data?.error || 'Server error');
      }

      if (!data?.imageBase64) {
        throw new Error('Kein Bild vom Server erhalten.');
      }

      const resultImage = buildDataUri(data.imageBase64);

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        role: 'ai',
        text: 'Here is your generated concept.',
        image: resultImage,
        canRegenerate: true,
        canExport: true,
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
    } catch (error: any) {
      console.log('Generate error:', error);

      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: 'ai',
        text:
          error?.message ||
          'Die Generierung ist fehlgeschlagen. Prüfe Server, Netzwerk und Render.',
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

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

  const regenerateFromMessage = async (message: Message) => {
    if (!message.generatePayload || loading) return;
    await generateImage(message.generatePayload);
  };

  const bottomOffset =
    keyboardHeight > 0 ? keyboardHeight + KEYBOARD_GAP : insets.bottom;

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.message,
          isUser ? styles.userMessage : styles.aiMessage,
        ]}
      >
        {item.image ? (
          <Pressable onPress={() => setFullscreenImage(item.image!)}>
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          </Pressable>
        ) : null}

        {item.text ? (
          <Text style={isUser ? styles.userText : styles.aiText}>
            {item.text}
          </Text>
        ) : null}

        {!isUser && item.image && (item.canRegenerate || item.canExport) ? (
          <View style={styles.actionRow}>
            {item.canRegenerate ? (
              <Pressable
                onPress={() => regenerateFromMessage(item)}
                style={styles.actionButton}
                disabled={loading}
              >
                <Ionicons name="refresh-outline" size={16} color="#ffffff" />
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
                  <Text style={styles.actionButtonText}>Teilen</Text>
                </Pressable>

                <Pressable
                  onPress={() => onSaveImage(item.image!)}
                  style={styles.actionButton}
                >
                  <Ionicons name="download-outline" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Speichern</Text>
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
          paddingBottom: 170,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Start creating</Text>
            <Text style={styles.emptyText}>
              Add a sketch and describe what you want to generate.
            </Text>
          </View>
        }
      />

      {selectedImage ? (
        <View style={[styles.previewRow, { bottom: bottomOffset + 72 }]}>
          <Pressable onPress={() => setFullscreenImage(selectedImage.uri)}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
          </Pressable>

          <View style={styles.previewTextWrap}>
            <Text style={styles.previewTitle}>Bild ausgewählt</Text>
            <Text style={styles.previewSubtitle}>
              Die Skizze wird jetzt mit dem Prompt zusammen gesendet.
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

        <Pressable
          onPress={sendMessage}
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#000000" />
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
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={26} color="#ffffff" />
          </Pressable>

          <Pressable
            style={styles.modalContent}
            onPress={() => setFullscreenImage(null)}
          >
            {fullscreenImage ? (
              <Image
                source={{ uri: fullscreenImage }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
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

  empty: {
    paddingHorizontal: 30,
    paddingTop: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    color: '#888888',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 21,
  },

  message: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '84%',
    marginBottom: 10,
  },
  userMessage: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: '#111111',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },

  userText: {
    color: '#000000',
    lineHeight: 20,
  },
  aiText: {
    color: '#ffffff',
    lineHeight: 20,
  },

  messageImage: {
    width: 250,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#111111',
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
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
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#0b0b0b',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#111111',
  },
  previewTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: '#888888',
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
});