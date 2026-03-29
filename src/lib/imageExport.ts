import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

function isDataUri(uri: string) {
  return typeof uri === 'string' && uri.startsWith('data:image/');
}

function getMimeTypeFromDataUri(uri: string) {
  const match = uri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  return match?.[1] || 'image/png';
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}

function extractBase64FromDataUri(dataUri: string) {
  const match = dataUri.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);

  if (!match?.[1]) {
    throw new Error('Ungültiges Bildformat');
  }

  return match[1];
}

async function createTempFileFromImageUri(imageUri: string) {
  if (!imageUri || typeof imageUri !== 'string') {
    throw new Error('Kein gültiges Bild vorhanden');
  }

  if (isDataUri(imageUri)) {
    const mimeType = getMimeTypeFromDataUri(imageUri);
    const extension = getExtensionFromMimeType(mimeType);
    const base64 = extractBase64FromDataUri(imageUri);

    const fileUri = `${FileSystem.cacheDirectory}sketchit-${Date.now()}.${extension}`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { fileUri, mimeType };
  }

  if (imageUri.startsWith('file://')) {
    const extensionMatch = imageUri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    const extension = extensionMatch?.[1] || 'jpg';

    const fileUri = `${FileSystem.cacheDirectory}sketchit-${Date.now()}.${extension}`;

    await FileSystem.copyAsync({
      from: imageUri,
      to: fileUri,
    });

    return {
      fileUri,
      mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
    };
  }

  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    const fileUri = `${FileSystem.cacheDirectory}sketchit-${Date.now()}.jpg`;

    await FileSystem.downloadAsync(imageUri, fileUri);

    return {
      fileUri,
      mimeType: 'image/jpeg',
    };
  }

  throw new Error('Nicht unterstütztes Bildformat');
}

async function ensureMediaLibraryPermission() {
  const current = await MediaLibrary.getPermissionsAsync();

  if (current.granted) {
    return;
  }

  const requested = await MediaLibrary.requestPermissionsAsync();

  if (!requested.granted) {
    throw new Error(
      'Speichern nicht erlaubt. Bitte erlaube in den Systemeinstellungen den Foto-/Medienzugriff für SketchIT.'
    );
  }
}

export async function saveImageToGallery(imageUri: string) {
  await ensureMediaLibraryPermission();

  const { fileUri } = await createTempFileFromImageUri(imageUri);

  try {
    const asset = await MediaLibrary.createAssetAsync(fileUri);

    const albumName = 'SketchIT';
    const album = await MediaLibrary.getAlbumAsync(albumName);

    if (!album) {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
      return;
    }

    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  } catch (error: any) {
    const message = String(error?.message || '');

    if (
      message.includes('didn\'t grant write permission') ||
      message.includes('write permission')
    ) {
      throw new Error(
        'Foto nicht gespeichert.'
      );
    }

    throw new Error('Das Bild konnte nicht gespeichert werden.');
  }
}

export async function shareImageFile(imageUri: string) {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }

  const { fileUri, mimeType } = await createTempFileFromImageUri(imageUri);

  try {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: 'Bild teilen',
    });
  } catch {
    throw new Error('Das Bild konnte nicht geteilt werden.');
  }
}