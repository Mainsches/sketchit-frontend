import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export type DuplicateAsset = {
  id: string;
  uri: string;
  filename: string;
  fileSize: number;
  width: number;
  height: number;
  creationTime?: number;
};

export type DuplicateGroup = {
  id: string;
  signature: string;
  items: DuplicateAsset[];
  keepAssetId: string;
  matchType: 'hash' | 'metadata';
};

export type DuplicateScanResult = {
  groups: DuplicateGroup[];
  scannedAssetCount: number;
  duplicateGroupCount: number;
  duplicateAssetCount: number;
};

type ScanProgressCallback = (progress: {
  stage: 'loading' | 'grouping' | 'hashing';
  processed: number;
  total: number;
}) => void;

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sortAssetsForKeep(items: DuplicateAsset[]) {
  return [...items].sort((a, b) => {
    const aTime = a.creationTime ?? 0;
    const bTime = b.creationTime ?? 0;

    if (aTime !== bTime) return aTime - bTime;
    return a.filename.localeCompare(b.filename);
  });
}

function buildResolutionSignature(asset: MediaLibrary.Asset): string | null {
  const width = normalizeNumber(asset.width);
  const height = normalizeNumber(asset.height);

  if (!width || !height) {
    return null;
  }

  return `${width}x${height}`;
}

async function getFileInfo(uri: string): Promise<{ size: number; md5: string | null }> {
  try {
    if (!uri) {
      return { size: 0, md5: null };
    }

    const info = await FileSystem.getInfoAsync(uri, { md5: true });

    if (!info?.exists) {
      return { size: 0, md5: null };
    }

    const size = normalizeNumber((info as any).size);
    const md5 =
      typeof (info as any).md5 === 'string' && (info as any).md5.length > 0
        ? (info as any).md5
        : null;

    return { size, md5 };
  } catch (error) {
    console.error('Error hashing asset for duplicate scan:', error);
    return { size: 0, md5: null };
  }
}

function toDuplicateAsset(
  asset: MediaLibrary.Asset,
  resolvedFileSize?: number
): DuplicateAsset {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename ?? 'Photo',
    fileSize: resolvedFileSize || normalizeNumber(asset.fileSize),
    width: normalizeNumber(asset.width),
    height: normalizeNumber(asset.height),
    creationTime:
      typeof asset.creationTime === 'number' ? asset.creationTime : undefined,
  };
}

async function yieldToUi() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function scanExactDuplicates(
  onProgress?: ScanProgressCallback
): Promise<DuplicateScanResult> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);

  if (!permission.granted) {
    throw new Error('PHOTO_PERMISSION_REQUIRED');
  }

  const allAssets: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  let hasNextPage = true;
  let loadedCount = 0;

  while (hasNextPage) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: 500,
      after,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    if (Array.isArray(page.assets)) {
      allAssets.push(...page.assets);
      loadedCount += page.assets.length;

      onProgress?.({
        stage: 'loading',
        processed: loadedCount,
        total: loadedCount,
      });
    }

    hasNextPage = page.hasNextPage;
    after = page.endCursor ?? undefined;
    await yieldToUi();
  }

  const resolutionBuckets = new Map<string, MediaLibrary.Asset[]>();

  for (let i = 0; i < allAssets.length; i += 1) {
    const asset = allAssets[i];
    const signature = buildResolutionSignature(asset);

    onProgress?.({
      stage: 'grouping',
      processed: i + 1,
      total: allAssets.length,
    });

    if (!signature) {
      continue;
    }

    const current = resolutionBuckets.get(signature) ?? [];
    current.push(asset);
    resolutionBuckets.set(signature, current);

    if (i % 200 === 0) {
      await yieldToUi();
    }
  }

  const candidateAssets: MediaLibrary.Asset[] = [];

  for (const assets of resolutionBuckets.values()) {
    if (Array.isArray(assets) && assets.length >= 2) {
      candidateAssets.push(...assets);
    }
  }

  const hashBuckets = new Map<string, DuplicateAsset[]>();
  const metadataBuckets = new Map<string, DuplicateAsset[]>();
  const totalCandidates = candidateAssets.length;

  for (let i = 0; i < candidateAssets.length; i += 1) {
    const asset = candidateAssets[i];

    onProgress?.({
      stage: 'hashing',
      processed: i + 1,
      total: totalCandidates,
    });

    const fileInfo = await getFileInfo(asset.uri);
    const resolvedSize = normalizeNumber(asset.fileSize) || fileInfo.size;
    const duplicateAsset = toDuplicateAsset(asset, resolvedSize);

    if (fileInfo.md5 && resolvedSize > 0) {
      const hashSignature = `${resolvedSize}__${fileInfo.md5}`;
      const current = hashBuckets.get(hashSignature) ?? [];
      current.push(duplicateAsset);
      hashBuckets.set(hashSignature, current);
    } else {
      const metadataSignature = `${resolvedSize}__${duplicateAsset.width}x${duplicateAsset.height}`;
      const current = metadataBuckets.get(metadataSignature) ?? [];
      current.push(duplicateAsset);
      metadataBuckets.set(metadataSignature, current);
    }

    if (i % 10 === 0) {
      await yieldToUi();
    }
  }

  const exactGroups: DuplicateGroup[] = [];

  for (const [signature, items] of hashBuckets.entries()) {
    if (!Array.isArray(items) || items.length < 2) {
      continue;
    }

    const sorted = sortAssetsForKeep(items);

    exactGroups.push({
      id: `hash__${signature}`,
      signature,
      items: sorted,
      keepAssetId: sorted[0].id,
      matchType: 'hash',
    });
  }

  const fallbackGroups: DuplicateGroup[] = [];

  if (exactGroups.length === 0) {
    for (const [signature, items] of metadataBuckets.entries()) {
      if (!Array.isArray(items) || items.length < 2) {
        continue;
      }

      const sorted = sortAssetsForKeep(items);

      fallbackGroups.push({
        id: `meta__${signature}`,
        signature,
        items: sorted,
        keepAssetId: sorted[0].id,
        matchType: 'metadata',
      });
    }
  }

  const groups = exactGroups.length > 0 ? exactGroups : fallbackGroups;

  groups.sort((a, b) => b.items.length - a.items.length);

  let duplicateAssetCount = 0;
  for (const group of groups) {
    if (Array.isArray(group.items) && group.items.length > 1) {
      duplicateAssetCount += group.items.length - 1;
    }
  }

  return {
    groups,
    scannedAssetCount: allAssets.length,
    duplicateGroupCount: groups.length,
    duplicateAssetCount,
  };
}

export async function deleteDuplicateAssets(assetIds: string[]) {
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return;
  }

  await MediaLibrary.deleteAssetsAsync(assetIds);
}

export function getSelectedDuplicateIds(
  groups: DuplicateGroup[] | undefined | null
): string[] {
  if (!Array.isArray(groups) || groups.length === 0) {
    return [];
  }

  const ids: string[] = [];

  for (const group of groups) {
    if (!group || !Array.isArray(group.items)) {
      continue;
    }

    for (const item of group.items) {
      if (item?.id && item.id !== group.keepAssetId) {
        ids.push(item.id);
      }
    }
  }

  return ids;
}
