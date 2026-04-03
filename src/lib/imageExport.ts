import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const ALBUM_NAME = 'SketchIT';

async function ensureLocalFileUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) {
    return uri;
  }

  const writableDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!writableDir) {
    throw new Error('No writable file directory available on this device.');
  }

  const ext = uri.includes('.png')
    ? 'png'
    : uri.includes('.webp')
    ? 'webp'
    : 'jpg';

  const targetUri = `${writableDir}sketchit_export_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({
    from: uri,
    to: targetUri,
  });

  return targetUri;
}

export async function saveImageToGallery(uri: string): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Gallery permission was denied.');
  }

  const localUri = await ensureLocalFileUri(uri);
  const asset = await MediaLibrary.createAssetAsync(localUri);
  const existingAlbum = await MediaLibrary.getAlbumAsync(ALBUM_NAME);

  if (existingAlbum) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
  } else {
    await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
  }
}

export async function shareImageFile(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  const localUri = await ensureLocalFileUri(uri);
  await Sharing.shareAsync(localUri);
}