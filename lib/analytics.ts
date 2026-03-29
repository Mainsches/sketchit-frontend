import { getApp } from '@react-native-firebase/app';
import {
  getAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';

const app = getApp();
const analytics = getAnalytics(app);

let analyticsCollectionAllowed = true;

export async function applyAnalyticsConsent(enabled: boolean) {
  analyticsCollectionAllowed = enabled;

  try {
    await setAnalyticsCollectionEnabled(analytics, enabled);
  } catch (error) {
    console.error('Error updating analytics consent:', error);
  }
}

async function safeLogEvent(name: string, params?: Record<string, any>) {
  if (!analyticsCollectionAllowed) return;

  try {
    await logEvent(analytics, name, params);
  } catch {}
}

export async function trackScreen(screenName: string) {
  await safeLogEvent('screen_view', {
    screen_name: screenName,
    screen_class: screenName,
  });
}

export async function trackSessionStart(source: string) {
  await safeLogEvent('swipesort_session_start', { source });
}

export async function trackSessionEnd(
  totalSwipes: number,
  keptCount: number,
  deletedCount: number,
  source: string
) {
  await safeLogEvent('swipesort_session_end', {
    total_swipes: totalSwipes,
    kept_count: keptCount,
    deleted_count: deletedCount,
    source,
  });
}

export async function trackSwipe(direction: 'left' | 'right', source: string) {
  await safeLogEvent('swipesort_photo_swipe', {
    direction,
    source,
  });
}

export async function trackOpenRandom() {
  await safeLogEvent('open_swipe_random');
}

export async function trackOpenAlbum() {
  await safeLogEvent('open_swipe_album');
}

export async function trackOpenDeleteList() {
  await safeLogEvent('open_delete_list');
}

export async function trackOpenKeptList() {
  await safeLogEvent('open_kept_list');
}

export async function trackConfirmDelete(count: number) {
  await safeLogEvent('confirm_delete', {
    count,
  });
}

export async function trackUndoDelete() {
  await safeLogEvent('undo_delete');
}

export async function trackExitToHome(from: string) {
  await safeLogEvent('exit_to_home', {
    from,
  });
}

export async function trackDuplicateFinderOpen() {
  await safeLogEvent('open_duplicate_finder');
}

export async function trackDuplicateScanStart() {
  await safeLogEvent('duplicate_scan_start');
}

export async function trackDuplicateScanComplete(
  scannedAssetCount: number,
  duplicateGroupCount: number,
  duplicateAssetCount: number
) {
  await safeLogEvent('duplicate_scan_complete', {
    scanned_asset_count: scannedAssetCount,
    duplicate_group_count: duplicateGroupCount,
    duplicate_asset_count: duplicateAssetCount,
  });
}

export async function trackDuplicateDelete(count: number) {
  await safeLogEvent('duplicate_delete', {
    count,
  });
}
