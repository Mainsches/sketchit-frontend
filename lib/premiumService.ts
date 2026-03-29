import { setPremiumUnlocked as applyPremiumToAds } from './ads/adService';
import {
  PremiumState,
  clearPremiumState,
  getPremiumState,
  savePremiumState,
  unlockPremiumState,
} from './storage';

type PremiumListener = (state: PremiumState) => void;

let currentPremiumState: PremiumState = {
  isPremium: false,
  purchasedAt: null,
  source: 'unknown',
  productId: null,
};

let initialized = false;
const listeners = new Set<PremiumListener>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(currentPremiumState);
    } catch (error) {
      console.error('Premium listener error:', error);
    }
  });
}

function applyState(state: PremiumState) {
  currentPremiumState = state;
  applyPremiumToAds(Boolean(state.isPremium));
  emit();
  return currentPremiumState;
}

export function getCurrentPremiumState() {
  return currentPremiumState;
}

export function isPremiumUnlocked() {
  return Boolean(currentPremiumState.isPremium);
}

export async function initializePremiumState() {
  if (initialized) {
    return currentPremiumState;
  }

  const stored = await getPremiumState();
  initialized = true;
  return applyState(stored);
}

export async function refreshPremiumState() {
  const stored = await getPremiumState();
  initialized = true;
  return applyState(stored);
}

export async function unlockPremium(input?: {
  productId?: string | null;
  source?: PremiumState['source'];
  purchasedAt?: number | null;
}) {
  const next = await unlockPremiumState(input);
  initialized = true;
  return applyState(next);
}

export async function setPremiumState(state: PremiumState) {
  await savePremiumState(state);
  initialized = true;
  return applyState(state);
}

export async function clearPremium() {
  await clearPremiumState();
  initialized = true;
  return applyState({
    isPremium: false,
    purchasedAt: null,
    source: 'unknown',
    productId: null,
  });
}

export function subscribeToPremiumState(listener: PremiumListener) {
  listeners.add(listener);
  listener(currentPremiumState);

  return () => {
    listeners.delete(listener);
  };
}