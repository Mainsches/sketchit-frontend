import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const locale = getLocales()?.[0]?.languageCode ?? 'en';

const resources = {
  en: {
    translation: {
      common: {
        start: 'Start',
        continue: 'Continue',
        history: 'History',
        settings: 'Settings',
        generate: 'Generate',
        save: 'Save',
        share: 'Share',
        category: 'Category',
        style: 'Style',
        material: 'Material',
        permissionRequired: 'Permission required',
        error: 'Error',
      },
      home: {
        subtitle: 'Turn sketches into designs',
        howItWorks: 'How it works',
        step1: '1. Upload a sketch',
        step2: '2. Choose category and style',
        step3: '3. Generate a mock concept',
      },
      upload: {
        title: 'Upload your sketch',
        subtitle: 'Upload or capture a simple furniture sketch.',
        noSketch: 'No sketch selected yet',
        gallery: 'Choose from gallery',
        camera: 'Take photo',
        galleryPermission: 'Please allow access to your photo library.',
        cameraPermission: 'Please allow camera access.',
      },
      options: {
        title: 'Design options',
        subtitle: 'Choose how the sketch should be transformed.',
      },
      loading: {
        title: 'Generating',
        subtitle: 'This is a mock MVP flow prepared for later backend and AI image generation.',
      },
      result: {
        title: 'Result',
        badge: 'Mock Render',
        noPreview: 'No preview available',
        noImage: 'No image available.',
        mediaPermission: 'Please allow media library access.',
        savedTitle: 'Saved',
        savedText: 'Image saved to your library.',
        shareUnavailable: 'Sharing is not available on this device.',
        generateAgain: 'Generate again',
      },
      history: {
        title: 'History',
        subtitle: 'Your previous concept generations',
        empty: 'No designs yet',
        preview: 'Preview',
      },
      settings: {
        title: 'Settings',
        subtitle: 'Prepared for release-ready settings later.',
        language: 'Language',
        quality: 'API quality',
        premium: 'Premium',
        premiumText: 'Premium features will come later.',
        backend: 'Backend',
        backendText: 'The service layer is prepared so we can connect a real backend later.',
      },
    },
  },
  de: {
    translation: {
      common: {
        start: 'Start',
        continue: 'Weiter',
        history: 'Verlauf',
        settings: 'Einstellungen',
        generate: 'Generieren',
        save: 'Speichern',
        share: 'Teilen',
        category: 'Kategorie',
        style: 'Stil',
        material: 'Material',
        permissionRequired: 'Berechtigung erforderlich',
        error: 'Fehler',
      },
      home: {
        subtitle: 'Turn sketches into designs',
        howItWorks: 'So funktioniert es',
        step1: '1. Skizze hochladen',
        step2: '2. Kategorie und Stil wählen',
        step3: '3. Mock-Konzept generieren',
      },
      upload: {
        title: 'Skizze hochladen',
        subtitle: 'Lade eine einfache Möbelskizze hoch oder fotografiere sie.',
        noSketch: 'Noch keine Skizze ausgewählt',
        gallery: 'Aus Galerie wählen',
        camera: 'Foto aufnehmen',
        galleryPermission: 'Bitte erlaube den Zugriff auf deine Fotogalerie.',
        cameraPermission: 'Bitte erlaube den Kamerazugriff.',
      },
      options: {
        title: 'Design-Optionen',
        subtitle: 'Wähle, wie die Skizze umgewandelt werden soll.',
      },
      loading: {
        title: 'Generierung',
        subtitle:
          'Dies ist ein Mock-MVP-Flow, vorbereitet für späteres Backend und KI-Bildgenerierung.',
      },
      result: {
        title: 'Ergebnis',
        badge: 'Mock-Render',
        noPreview: 'Keine Vorschau verfügbar',
        noImage: 'Kein Bild verfügbar.',
        mediaPermission: 'Bitte erlaube den Zugriff auf die Mediathek.',
        savedTitle: 'Gespeichert',
        savedText: 'Bild wurde in deiner Galerie gespeichert.',
        shareUnavailable: 'Teilen ist auf diesem Gerät nicht verfügbar.',
        generateAgain: 'Neu generieren',
      },
      history: {
        title: 'Verlauf',
        subtitle: 'Deine bisherigen Konzept-Generierungen',
        empty: 'Noch keine Designs',
        preview: 'Vorschau',
      },
      settings: {
        title: 'Einstellungen',
        subtitle: 'Vorbereitet für spätere releasefähige Einstellungen.',
        language: 'Sprache',
        quality: 'API-Qualität',
        premium: 'Premium',
        premiumText: 'Premium-Funktionen kommen später.',
        backend: 'Backend',
        backendText:
          'Der Service-Layer ist vorbereitet, damit wir später ein echtes Backend anbinden können.',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources,
  lng: locale === 'de' ? 'de' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;