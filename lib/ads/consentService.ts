import { AdsConsent } from 'react-native-google-mobile-ads';
import {
  getAdsRequestNonPersonalizedOnly,
  initializeAds,
  setAdsEnabled,
  setAdsRequestNonPersonalizedOnly,
} from './adService';

export type AdConsentState = {
  status: string;
  canRequestAds: boolean;
  gdprApplies: boolean;
  requestNonPersonalizedAdsOnly: boolean;
  consentFormAvailable: boolean;
  privacyOptionsRequired: boolean;
  privacyOptionsRequirementStatus: string;
};

let currentAdConsentState: AdConsentState = {
  status: 'UNKNOWN',
  canRequestAds: false,
  gdprApplies: false,
  requestNonPersonalizedAdsOnly: true,
  consentFormAvailable: false,
  privacyOptionsRequired: false,
  privacyOptionsRequirementStatus: 'UNKNOWN',
};

function getConsentRequestOptions() {
  return undefined;
}

function isPrivacyOptionsRequired(info: any) {
  return String(info?.privacyOptionsRequirementStatus ?? 'UNKNOWN') === 'REQUIRED';
}

function normalizeConsentState(
  info: any,
  gdprApplies: boolean,
  requestNonPersonalizedAdsOnly: boolean
): AdConsentState {
  return {
    status: String(info?.status ?? 'UNKNOWN'),
    canRequestAds: Boolean(info?.canRequestAds),
    gdprApplies,
    requestNonPersonalizedAdsOnly,
    consentFormAvailable: Boolean(info?.isConsentFormAvailable),
    privacyOptionsRequired: isPrivacyOptionsRequired(info),
    privacyOptionsRequirementStatus: String(
      info?.privacyOptionsRequirementStatus ?? 'UNKNOWN'
    ),
  };
}

export function getCurrentAdConsentState() {
  return currentAdConsentState;
}

async function resolveConsentChoices(gdprApplies: boolean) {
  try {
    const choices = await AdsConsent.getUserChoices();

    if (!gdprApplies) {
      return false;
    }

    return choices?.selectPersonalisedAds === false;
  } catch (error) {
    console.error('Could not read consent choices:', error);
    return gdprApplies ? getAdsRequestNonPersonalizedOnly() : false;
  }
}

async function applyAdStateFromInfo(info: any) {
  let gdprApplies = false;

  try {
    gdprApplies = await AdsConsent.getGdprApplies();
  } catch (error) {
    console.error('Could not read GDPR status:', error);
  }

  const requestNonPersonalizedAdsOnly = await resolveConsentChoices(gdprApplies);

  currentAdConsentState = normalizeConsentState(
    info,
    gdprApplies,
    requestNonPersonalizedAdsOnly
  );

  setAdsRequestNonPersonalizedOnly(requestNonPersonalizedAdsOnly);
  setAdsEnabled(currentAdConsentState.canRequestAds);

  if (currentAdConsentState.canRequestAds) {
    await initializeAds();
  }

  return currentAdConsentState;
}

export async function collectAndApplyAdConsent(): Promise<AdConsentState> {
  const options = getConsentRequestOptions();

  try {
    await AdsConsent.gatherConsent(options);
  } catch (error) {
    console.error('Consent gathering failed:', error);
  }

  let latestInfo: any = null;

  try {
    latestInfo = await AdsConsent.getConsentInfo();
  } catch (error) {
    console.error('Could not read consent info:', error);
  }

  return applyAdStateFromInfo(latestInfo);
}

export async function openPrivacyOptionsFormIfRequired() {
  const adsConsentAny = AdsConsent as typeof AdsConsent & {
    showPrivacyOptionsForm?: () => Promise<any>;
  };

  if (typeof adsConsentAny.showPrivacyOptionsForm !== 'function') {
    return currentAdConsentState;
  }

  try {
    await adsConsentAny.showPrivacyOptionsForm();
  } catch (error) {
    console.error('Privacy options form failed:', error);
    throw error;
  }

  let latestInfo: any = null;

  try {
    latestInfo = await AdsConsent.getConsentInfo();
  } catch (error) {
    console.error('Could not read consent info after privacy options:', error);
  }

  return applyAdStateFromInfo(latestInfo);
}