import { SupportedLanguage, LANGUAGE_CONFIG } from '../i18n/translations';

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'ERROR'
  | 'UNAVAILABLE';

export type VoiceErrorCode =
  | 'NOT_ALLOWED'
  | 'NO_SPEECH'
  | 'LANGUAGE_UNSUPPORTED'
  | 'NETWORK_ERROR'
  | 'AUDIO_CAPTURE'
  | 'UNKNOWN';

export interface VoiceErrorDetails {
  code: VoiceErrorCode;
  rawError?: string;
  message: string;
  language: SupportedLanguage;
  locale: string;
}

export interface VoiceRecognitionCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: VoiceErrorDetails) => void;
  onEnd: () => void;
}

/**
 * Standardized BCP-47 speech recognition locale mapping
 */
export const SPEECH_LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
};

/**
 * Singleton Service for SpeechRecognition / webkitSpeechRecognition
 * Encapsulates browser compatibility, lifecycle, locale reconfiguration,
 * interim token capture, and specific human-readable error handling.
 */
class VoiceRecognitionService {
  private recognition: any = null;
  private currentLanguage: SupportedLanguage = 'en';
  private sessionId = 0;
  private isListening = false;
  private currentCallbacks: VoiceRecognitionCallbacks | null = null;
  private accumulatedFinal = '';
  private lastInterim = '';

  /**
   * Detects Web Speech API support in browser
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public getActiveLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public getActiveLocale(lang?: SupportedLanguage): string {
    const target = lang || this.currentLanguage;
    return SPEECH_LOCALES[target] || 'en-IN';
  }

  /**
   * Safely stop and discard any active recognition session
   */
  public stop(): void {
    this.sessionId++;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
  }

  /**
   * Immediately abort recognition session
   */
  public abort(): void {
    this.sessionId++;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;
    }
  }

  /**
   * Language Switch: safely terminates active session and clears cached instance
   */
  public reinitialize(newLang: SupportedLanguage): void {
    this.abort();
    this.currentLanguage = newLang;
  }

  /**
   * Start Speech Recognition in the requested language
   */
  public start(lang: SupportedLanguage, callbacks: VoiceRecognitionCallbacks): void {
    if (!this.isSupported()) {
      callbacks.onStateChange('UNAVAILABLE');
      callbacks.onError({
        code: 'LANGUAGE_UNSUPPORTED',
        message: 'Speech recognition is not supported in this browser. Please use typed input.',
        language: lang,
        locale: this.getActiveLocale(lang)
      });
      return;
    }

    // Safely abort any existing session
    this.abort();

    this.currentLanguage = lang;
    this.currentCallbacks = callbacks;
    this.accumulatedFinal = '';
    this.lastInterim = '';

    const session = ++this.sessionId;
    const targetLocale = this.getActiveLocale(lang);
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      const recognition = new SpeechRecognitionClass();
      this.recognition = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = targetLocale;

      recognition.onstart = () => {
        if (session !== this.sessionId) return;
        this.isListening = true;
        callbacks.onStateChange('LISTENING');
      };

      recognition.onresult = (event: any) => {
        if (session !== this.sessionId) return;

        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || '';
          if (item.isFinal) {
            finalStr += transcriptText;
          } else {
            interim += transcriptText;
          }
        }

        if (finalStr.trim()) {
          this.accumulatedFinal += (this.accumulatedFinal ? ' ' : '') + finalStr.trim();
          callbacks.onTranscript(this.accumulatedFinal, true);
        } else if (interim.trim()) {
          this.lastInterim = interim.trim();
          callbacks.onTranscript(this.lastInterim, false);
        }
      };

      recognition.onerror = (event: any) => {
        if (session !== this.sessionId) return;
        const errType = event.error || 'unknown';

        // 'aborted' is intentional when user clicks stop or changes language; ignore cleanly
        if (errType === 'aborted') {
          this.isListening = false;
          callbacks.onStateChange('IDLE');
          return;
        }

        this.isListening = false;
        callbacks.onStateChange('ERROR');

        let code: VoiceErrorCode = 'UNKNOWN';
        let friendlyMsg = 'Voice recognition error. You can type your question instead.';
        const langName = LANGUAGE_CONFIG[lang]?.label || lang;

        switch (errType) {
          case 'not-allowed':
          case 'service-not-allowed':
            code = 'NOT_ALLOWED';
            friendlyMsg = 'Microphone permission is required for voice input. Please allow microphone access in your browser settings.';
            break;
          case 'no-speech':
            code = 'NO_SPEECH';
            friendlyMsg = "I couldn't hear any speech. Please tap the microphone and try again.";
            break;
          case 'language-not-supported':
            code = 'LANGUAGE_UNSUPPORTED';
            friendlyMsg = `Voice recognition for ${langName} (${targetLocale}) is not supported by this browser. You can still type your question.`;
            break;
          case 'network':
            code = 'NETWORK_ERROR';
            friendlyMsg = 'Voice recognition service is temporarily unreachable. Please check your internet connection or use text input.';
            break;
          case 'audio-capture':
            code = 'AUDIO_CAPTURE';
            friendlyMsg = 'No microphone was detected or your microphone is in use by another application.';
            break;
          default:
            code = 'UNKNOWN';
            friendlyMsg = `Voice recognition error (${errType}). Please try again or type your question.`;
            break;
        }

        callbacks.onError({
          code,
          rawError: errType,
          message: friendlyMsg,
          language: lang,
          locale: targetLocale
        });
      };

      recognition.onend = () => {
        if (session !== this.sessionId) return;
        this.isListening = false;
        this.recognition = null;

        // If recognition closed and we have pending interim text that was never finalized, emit it
        const finalCandidate = (this.accumulatedFinal.trim() || this.lastInterim.trim());
        if (finalCandidate) {
          callbacks.onTranscript(finalCandidate, true);
        }

        callbacks.onEnd();
      };

      recognition.start();
    } catch (err: any) {
      this.isListening = false;
      this.recognition = null;

      if (err?.name === 'InvalidStateError') {
        // Active instance transition glitch; safely reset
        callbacks.onStateChange('IDLE');
      } else {
        callbacks.onStateChange('ERROR');
        callbacks.onError({
          code: 'UNKNOWN',
          rawError: err?.message,
          message: 'Unable to start speech recognition. Please try again.',
          language: lang,
          locale: targetLocale
        });
      }
    }
  }
}

export const voiceRecognitionService = new VoiceRecognitionService();
