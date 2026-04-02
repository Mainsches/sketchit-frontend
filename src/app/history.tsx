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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async (showAlertOnError = false) => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const items = await loadHistoryItems();

      if (Array.isArray(items)) {
        setHistory(items);
      } else {
        setHistory([]);
      }
    } catch (error: any) {
      console.log('HistoryScreen loadHistory error:', error);

      setHistory([]);
      setLoadError(
        'The history could not be loaded. This is likely caused by an old oversized saved entry.'
      );

      if (showAlertOnError) {
        Alert.alert(
          'History error',
          'The history could not be loaded. This is likely caused by an old oversized saved entry.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        try {
          setIsLoading(true);
          setLoadError(null);

          const items = await loadHistoryItems();

          if (!isActive) return;

          if (Array.isArray(items)) {
            setHistory(items);
          } else {
            setHistory([]);
          }
        } catch (error: any) {
          if (!isActive) return;

          console.log('HistoryScreen useFocusEffect load error:', error);

          setHistory([]);
          setLoadError(
            'The history could not be loaded. This is likely caused by an old oversized saved entry.'
          );
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      run();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const onShareImage = async (imageUri: string) => {
    try {
      await shareImageFile(imageUri);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'The image could not be shared.');
    }
  };

  const onSaveImage = async (imageUri: string) => {
    try {
      await saveImageToGallery(imageUri);
      Alert.alert('Saved', 'The image was saved to your gallery.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'The image could not be saved.');
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.createdAt);
    const resultImage = (item as any).resultImage || (item as any).imageUrl || '';

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => {
            if (resultImage) {
              setFullscreenImage(resultImage);
            }
          }}
        >
          <Image source={{ uri: resultImage }} style={styles.image} />
        </Pressable>

        <Text style={styles.prompt} numberOfLines={2}>
          {item.prompt || 'No description'}
        </Text>

        <Text style={styles.date}>
          {date.toLocaleDateString()} • {date.toLocaleTimeString()}
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onShareImage(resultImage)}
            style={styles.actionButton}
          >
            <Ionicons name="share-outline" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Share</Text>
          </Pressable>

          <Pressable
            onPress={() => onSaveImage(resultImage)}
            style={styles.actionButton}
          >
            <Ionicons name="download-outline" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar title="History" showBack />

      {isLoading ? (
        <View style={styles.content}>
          <Text style={styles.title}>Loading history...</Text>
          <Text style={styles.subtitle}>Please wait a moment.</Text>
        </View>
      ) : loadError ? (
        <View style={styles.content}>
          <Text style={styles.title}>History unavailable</Text>
          <Text style={styles.subtitle}>{loadError}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => loadHistory(true)}
          >
            <Ionicons name="refresh-outline" size={16} color="#ffffff" />
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.content}>
          <Text style={styles.title}>No history yet</Text>
          <Text style={styles.subtitle}>
            Your generated images will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id || String(index)}
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
    textAlign: 'center',
  },

  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  retryButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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