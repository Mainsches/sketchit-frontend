import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import TopBar from '../../components/TopBar';
import { HistoryItem, loadHistoryItems } from '../lib/history';
import { saveImageToGallery, shareImageFile } from '../lib/imageExport';

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const loadHistory = async () => {
    const items = await loadHistoryItems();
    setHistory(items);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

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

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.createdAt);

    return (
      <View style={styles.card}>
        <Pressable onPress={() => setFullscreenImage(item.resultImage)}>
          <Image source={{ uri: item.resultImage }} style={styles.image} />
        </Pressable>

        <Text style={styles.prompt} numberOfLines={2}>
          {item.prompt || 'No description'}
        </Text>

        <Text style={styles.date}>
          {date.toLocaleDateString()} • {date.toLocaleTimeString()}
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onShareImage(item.resultImage)}
            style={styles.actionButton}
          >
            <Ionicons name="share-outline" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Teilen</Text>
          </Pressable>

          <Pressable
            onPress={() => onSaveImage(item.resultImage)}
            style={styles.actionButton}
          >
            <Ionicons name="download-outline" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Speichern</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar title="History" showBack />

      {history.length === 0 ? (
        <View style={styles.content}>
          <Text style={styles.title}>No history yet</Text>
          <Text style={styles.subtitle}>
            Your generated sketches will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },

  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
  },

  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#0f0f0f',
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },

  image: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#111',
  },

  prompt: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  date: {
    color: '#777',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },

  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});