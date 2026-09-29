import { SupportedLanguage, LANGUAGE_CONFIG } from '../i18n/translations';
import { SPEECH_LOCALES } from './voiceRecognitionService';

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export interface SpeakResult {
  success: boolean;
  reason?: 'UNSUPPORTED' | 'NO_NATIVE_VOICE' | 'EMPTY_TEXT' | 'ERROR';
  message?: string;
}

/**
 * Singleton Service for Text-to-Speech (speechSynthesis)
 * Handles voice indexing, language-specific voice discovery,
 * text sanitization, and strict native voice enforcement.
 */
class TextToSpeechService {
  private voices: SpeechSynthesisVoice[] = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private initialized = false;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          this.voices = v;
          this.initialized = true;
        }
      } catch (e) {}
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.isSupported()) {
      try {
        this.voices = window.speechSynthesis.getVoices();
      } catch (e) {}
    }
    return this.voices;
  }

  /**
   * Finds the most suitable native voice for the given language
   */
  public getBestVoiceFor(lang: SupportedLanguage): SpeechSynthesisVoice | null {
    const allVoices = this.getVoices();
    if (allVoices.length === 0) return null;

    const targetLocale = (SPEECH_LOCALES[lang] || 'en-IN').toLowerCase();
    const langPrefix = lang.toLowerCase();

    // 1. Exact locale match (e.g., 'ta-in' or 'ta_in')
    const exactMatch = allVoices.find(v => {
      const vl = v.lang.toLowerCase().replace('_', '-');
      return vl === targetLocale;
    });
    if (exactMatch) return exactMatch;

    // 2. Language prefix match (e.g., starts with 'ta' for Tamil)
    const prefixMatch = allVoices.find(v => {
      const vl = v.lang.toLowerCase().replace('_', '-');
      return vl.startsWith(langPrefix + '-') || vl.startsWith(langPrefix + '_') || vl === langPrefix;
    });
    if (prefixMatch) return prefixMatch;

    // For English only, allow generic English voices (en-US, en-GB) as fallback
    if (lang === 'en') {
      const englishVoice = allVoices.find(v => v.lang.toLowerCase().startsWith('en'));
      if (englishVoice) return englishVoice;
    }

    return null;
  }

  public hasNativeVoiceFor(lang: SupportedLanguage): boolean {
    return this.getBestVoiceFor(lang) !== null;
  }

  /**
   * Prepares clean verbal text for natural speech synthesis
   * Strips URLs, markdown syntax, coordinates, and bracketed action labels.
   */
  public sanitizeSpokenText(text: string): string {
    return text
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\b\d+\.\d+°\s*[NE]\b/gi, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[*_#•\n\r]/g, ' ')
      .replace(/[—–]/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 360);
  }

  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    this.activeUtterance = null;
  }

  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  /**
   * Speaks the text in the requested language
   */
  public speak(
    rawText: string,
    lang: SupportedLanguage,
    callbacks?: TTSCallbacks
  ): SpeakResult {
    if (!this.isSupported()) {
      return {
        success: false,
        reason: 'UNSUPPORTED',
        message: 'Speech synthesis is not supported in this browser.'
      };
    }

    this.stop(); // Stop any active utterance before speaking

    const cleanText = this.sanitizeSpokenText(rawText);
    if (!cleanText) {
      return { success: false, reason: 'EMPTY_TEXT' };
    }

    const targetLocale = SPEECH_LOCALES[lang] || 'en-IN';
    const voice = this.getBestVoiceFor(lang);

    // Strict safety check: Never read non-English Indian languages with an English TTS voice
    if (lang !== 'en' && !voice) {
      const langName = LANGUAGE_CONFIG[lang]?.label || lang;
      return {
        success: false,
        reason: 'NO_NATIVE_VOICE',
        message: `Native speech engine for ${langName} is not available on this device.`
      };
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      this.activeUtterance = utterance;

      utterance.lang = targetLocale;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        callbacks?.onStart?.();
      };

      utterance.onend = () => {
        this.activeUtterance = null;
        callbacks?.onEnd?.();
      };

      utterance.onerror = (err) => {
        this.activeUtterance = null;
        // Ignore canceled errors resulting from stop()
        if (err.error !== 'canceled' && err.error !== 'interrupted') {
          callbacks?.onError?.(err);
        } else {
          callbacks?.onEnd?.();
        }
      };

      window.speechSynthesis.speak(utterance);
      return { success: true };
    } catch (err: any) {
      this.activeUtterance = null;
      return {
        success: false,
        reason: 'ERROR',
        message: err?.message || 'Speech synthesis error.'
      };
    }
  }
}

export const textToSpeechService = new TextToSpeechService();
