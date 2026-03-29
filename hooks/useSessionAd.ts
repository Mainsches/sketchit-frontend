import { useCallback } from 'react';
import {
  markInterstitialDueForSwipe,
  maybeShowPendingInterstitial,
  resetInterstitialCounter,
} from '../lib/ads/adService';

export function useSessionAd() {
  const registerSwipe = useCallback(() => {
    markInterstitialDueForSwipe();
  }, []);

  const showPendingInterstitialIfReady = useCallback(() => {
    maybeShowPendingInterstitial();
  }, []);

  const resetSessionAdCounter = useCallback(() => {
    resetInterstitialCounter();
  }, []);

  return {
    registerSwipe,
    showPendingInterstitialIfReady,
    resetSessionAdCounter,
  };
}
