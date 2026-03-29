import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads';

let initialized = false;
let adsEnabled = false;
let requestNonPersonalizedAdsOnly = true;
let premiumUnlocked = false;

let swipesSinceLastInterstitial = 0;
let swipesPerInterstitial = 60;
let interstitialDue = false;
let interstitialLoaded = false;
let interstitialLoading = false;

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_RETRY_DELAY_MS = 30000;

const productionInterstitialId = 'ca-app-pub-7854184980478887/5423381592';
const interstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : productionInterstitialId;

let interstitial: InterstitialAd | null = null;

function clearRetryTimer() {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
}

function resetInterstitialInstance() {
  interstitial = null;
  interstitialLoaded = false;
  interstitialLoading = false;
}

function clearAdsState() {
  interstitialDue = false;
  clearRetryTimer();
  retryCount = 0;
  resetInterstitialInstance();
}

function scheduleInterstitialRetry(reason?: string) {
  if (!canShowAd()) return;
  if (interstitialLoaded || interstitialLoading || retryTimeout) return;

  retryCount += 1;
  const delay = Math.min(2000 * retryCount, MAX_RETRY_DELAY_MS);

  if (reason && __DEV__) {
    console.log(`Interstitial retry scheduled in ${delay}ms (${reason})`);
  }

  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    createAndLoadInterstitial();
  }, delay);
}

function attachInterstitialListeners(ad: InterstitialAd) {
  ad.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    interstitialLoading = false;
    retryCount = 0;
    clearRetryTimer();
  });

  ad.addAdEventListener(AdEventType.CLOSED, () => {
    resetInterstitialInstance();
    clearRetryTimer();
    createAndLoadInterstitial();
  });

  ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
    resetInterstitialInstance();

    const code = String(error?.code ?? 'unknown');
    const message = String(error?.message ?? '');
    const isNoFill = code.includes('no-fill') || message.toLowerCase().includes('no fill');

    if (__DEV__) {
      if (isNoFill) {
        console.log('Interstitial not available yet (no fill).');
      } else {
        console.error('Interstitial error:', error);
      }
    }

    scheduleInterstitialRetry(isNoFill ? 'no-fill' : code);
  });
}

function createAndLoadInterstitial() {
  if (!initialized || !canShowAd()) return;
  if (interstitialLoading || interstitialLoaded) return;

  clearRetryTimer();
  interstitialLoading = true;
  interstitialLoaded = false;

  interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
    requestNonPersonalizedAdsOnly,
  });

  attachInterstitialListeners(interstitial);
  interstitial.load();
}

export async function initializeAds() {
  if (initialized) {
    if (canShowAd() && !interstitialLoaded && !interstitialLoading) {
      createAndLoadInterstitial();
    }
    return;
  }

  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    await mobileAds().initialize();
    initialized = true;
    createAndLoadInterstitial();
  } catch (error) {
    console.error('Ad init failed:', error);
    scheduleInterstitialRetry('init-failed');
  }
}

export function setAdsEnabled(value: boolean) {
  adsEnabled = value;

  if (!canShowAd()) {
    clearAdsState();
    return;
  }

  if (initialized && !interstitialLoaded && !interstitialLoading) {
    createAndLoadInterstitial();
  }
}

export function setAdsRequestNonPersonalizedOnly(value: boolean) {
  requestNonPersonalizedAdsOnly = value;

  if (initialized && canShowAd()) {
    clearAdsState();
    createAndLoadInterstitial();
  }
}

export function getAdsRequestNonPersonalizedOnly() {
  return requestNonPersonalizedAdsOnly;
}

export function setAdFrequency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return;
  swipesPerInterstitial = Math.floor(value);
}

export function getAdFrequency() {
  return swipesPerInterstitial;
}

export function setPremiumUnlocked(value: boolean) {
  premiumUnlocked = value;

  if (!canShowAd()) {
    clearAdsState();
    return;
  }

  if (initialized && !interstitialLoaded && !interstitialLoading) {
    createAndLoadInterstitial();
  }
}

export function isPremiumBlockingAds() {
  return premiumUnlocked;
}

export function canShowAd() {
  return adsEnabled && !premiumUnlocked;
}

export function resetInterstitialCounter() {
  swipesSinceLastInterstitial = 0;
  interstitialDue = false;
}

export function resetAdSessionState() {
  resetInterstitialCounter();
}

export function markInterstitialDueForSwipe() {
  if (!canShowAd()) return;

  swipesSinceLastInterstitial += 1;

  if (swipesSinceLastInterstitial >= swipesPerInterstitial) {
    swipesSinceLastInterstitial = 0;
    interstitialDue = true;

    if (!interstitialLoaded && !interstitialLoading) {
      createAndLoadInterstitial();
    }
  }
}

export function maybeShowPendingInterstitial() {
  if (!canShowAd() || !interstitialDue) {
    return false;
  }

  if (!interstitialLoaded || !interstitial) {
    if (!interstitialLoading) {
      createAndLoadInterstitial();
    }
    return false;
  }

  try {
    interstitialDue = false;
    interstitial.show();
    return true;
  } catch (error) {
    console.error('Failed to show pending interstitial:', error);
    resetInterstitialInstance();
    scheduleInterstitialRetry('show-pending-failed');
    return false;
  }
}

export function showAdImmediatelyIfReady() {
  if (!canShowAd()) {
    return false;
  }

  if (!interstitialLoaded || !interstitial) {
    if (!interstitialLoading) {
      createAndLoadInterstitial();
    }
    return false;
  }

  try {
    interstitialDue = false;
    interstitial.show();
    return true;
  } catch (error) {
    console.error('Failed to show immediate interstitial:', error);
    resetInterstitialInstance();
    scheduleInterstitialRetry('show-immediate-failed');
    return false;
  }
}
