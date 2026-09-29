import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Bot, Mic, MicOff, Volume2, VolumeX, Square, MapPin, Navigation, RotateCcw, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useNexoraStore } from '../../store/useNexoraStore';
import { getTranslation, SupportedLanguage, LANGUAGE_CONFIG } from '../../i18n/translations';
import { voiceRecognitionService, VoiceState, VoiceErrorDetails, SPEECH_LOCALES } from '../../services/voiceRecognitionService';
import { textToSpeechService } from '../../services/textToSpeechService';
import { streamChatCompletion, isAiOnline, warmUpProvider, getLastAiError } from '../../services/llmService';
import { buildLiveSnapshot, buildSystemPrompt, extractLocationBlock, type LocationAction } from '../../services/chatEngine';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  locationAction?: LocationAction;
}

interface BotResponseResult {
  text: string;
  locationAction?: LocationAction;
}

export type VoiceAssistantState = VoiceState;

interface VoiceNoticeState {
  message: string;
  canRetryVoices?: boolean;
}

export const NexoraChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceAssistantState>('IDLE');
  const [isMicSupported, setIsMicSupported] = useState(voiceRecognitionService.isSupported());
  const [voiceNotice, setVoiceNotice] = useState<VoiceNoticeState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Mini-ChatGPT state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const genIdRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  // AI connectivity: drives the launcher dot + header chip + fallback notice
  const [aiStatus, setAiStatus] = useState<'checking' | 'online' | 'offline'>(
    isAiOnline() === false ? 'offline' : 'checking'
  );
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const {
    currentLanguage,
    isOffline,
    mapDataStatus,
    overallRiskLevel,
    riverLevelMeters,
    dangerMarkMeters,
    rainfallMmPerHour,
    windSpeedKmh,
    sosReports,
    shelters,
    blockedRoads,
    district,
    hospitals,
    evacuationRoutes,
    setCurrentView,
    setActiveEvacuationRoute,
    setFocusedMapLocation,
  } = useNexoraStore();

  const t = (k: string, f?: string) => getTranslation(currentLanguage, k, f);

  // The Online/Offline switch in the top bar is the master network switch for
  // the whole app. While it reads OFFLINE the assistant must not touch the
  // network at all and answers from the on-device (pretrained) engine only.
  // Mirrors the exact condition TopBar uses to paint the button, so the
  // chatbot can never disagree with what the operator sees.
  const isForcedOffline = isOffline || mapDataStatus === 'OFFLINE';



  // Dynamic greeting matching active language (short & warm, like a real AI chat)
  const getGreeting = useCallback((lang: SupportedLanguage): string => {
    switch (lang) {
      case 'ta':
        return 'à®µà®£à®•à¯à®•à®®à¯! ðŸ‘‹ à®¨à®¾à®©à¯ NEXORA AI â€” à®µà¯†à®³à¯à®³ à®¨à®¿à®²à®µà®°à®®à¯, à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®© à®®à¯à®•à®¾à®®à¯à®•à®³à¯, à®µà¯†à®³à®¿à®¯à¯‡à®±à¯à®±à®ªà¯ à®ªà®¾à®¤à¯ˆà®•à®³à¯ à®ªà®±à¯à®±à®¿ à®Žà®¤à¯à®µà¯à®®à¯ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯â€¦ à®…à®²à¯à®²à®¤à¯ à®šà®¾à®¤à®¾à®°à®£à®®à®¾à®•à®ªà¯ à®ªà¯‡à®šà®²à®¾à®®à¯.';
      case 'hi':
        return 'à¤¨à¤®à¤¸à¥à¤¤à¥‡! ðŸ‘‹ à¤®à¥ˆà¤‚ NEXORA AI à¤¹à¥‚à¤‚ â€” à¤¬à¤¾à¤¢à¤¼ à¤•à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿, à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¶à¤¿à¤µà¤¿à¤°, à¤¨à¤¿à¤•à¤¾à¤¸à¥€ à¤®à¤¾à¤°à¥à¤—à¥‹à¤‚ à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤•à¥à¤› à¤­à¥€ à¤ªà¥‚à¤›à¥‡à¤‚â€¦ à¤¯à¤¾ à¤¬à¤¸ à¤šà¥ˆà¤Ÿ à¤•à¤°à¥‡à¤‚à¥¤';
      case 'te':
        return 'à°¨à°®à°¸à±à°•à°¾à°°à°‚! ðŸ‘‹ à°¨à±‡à°¨à± NEXORA AI â€” à°µà°°à°¦ à°ªà°°à°¿à°¸à±à°¥à°¿à°¤à°¿, à°¸à±à°°à°•à±à°·à°¿à°¤ à°†à°¶à±à°°à°¯à°¾à°²à±, à°¤à°°à°²à°¿à°‚à°ªà± à°®à°¾à°°à±à°—à°¾à°² à°—à±à°°à°¿à°‚à°šà°¿ à°à°¦à±ˆà°¨à°¾ à°…à°¡à°—à°‚à°¡à°¿â€¦ à°²à±‡à°¦à°¾ à°¸à°°à°¦à°¾à°—à°¾ à°®à°¾à°Ÿà±à°²à°¾à°¡à°µà°šà±à°šà±.';
      case 'ml':
        return 'à´¨à´®à´¸àµà´•à´¾à´°à´‚! ðŸ‘‹ à´žà´¾àµ» NEXORA AI â€” à´µàµ†à´³àµà´³à´ªàµà´ªàµŠà´•àµà´• à´¸àµà´¥à´¿à´¤à´¿, à´¸àµà´°à´•àµà´·à´¿à´¤ à´•àµ‡à´¨àµà´¦àµà´°à´™àµà´™àµ¾, à´’à´´à´¿à´ªàµà´ªà´¿à´•àµà´•àµ½ à´µà´´à´¿à´•àµ¾ à´Žà´¨àµà´¨à´¿à´µà´¯àµ†à´•àµà´•àµà´±à´¿à´šàµà´šàµ à´Žà´¨àµà´¤àµà´‚ à´šàµ‹à´¦à´¿à´•àµà´•àµ‚â€¦ à´…à´²àµà´²àµ†à´™àµà´•à´¿àµ½ à´µàµ†à´±àµà´¤àµ† à´¸à´‚à´¸à´¾à´°à´¿à´•àµà´•à´¾à´‚.';
      case 'bn':
        return 'à¦¨à¦®à¦¸à§à¦•à¦¾à¦°! ðŸ‘‹ à¦†à¦®à¦¿ NEXORA AI â€” à¦¬à¦¨à§à¦¯à¦¾ à¦ªà¦°à¦¿à¦¸à§à¦¥à¦¿à¦¤à¦¿, à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦†à¦¶à§à¦°à¦¯à¦¼, à¦¸à¦°à¦¿à¦¯à¦¼à§‡ à¦¨à§‡à¦“à¦¯à¦¼à¦¾à¦° à¦°à§à¦Ÿ à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡ à¦•à¦¿à¦›à§ à¦œà¦¿à¦œà§à¦žà¦¾à¦¸à¦¾ à¦•à¦°à§à¦¨â€¦ à¦…à¦¥à¦¬à¦¾ à¦¶à§à¦§à§ à¦•à¦¥à¦¾ à¦¬à¦²à§à¦¨à¥¤';
      case 'en':
      default:
        return 'Hey there! ðŸ‘‹ I\'m NEXORA AI â€” ask me anything about the flood situation, safe shelters, evacuation routesâ€¦ or just chat.';
    }
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-init',
      sender: 'bot',
      text: getGreeting(currentLanguage),
      timestamp: 'Just now'
    }
  ]);

  // Keep a live copy of messages for building LLM history without stale closures
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Warm up the AI model at startup so the first reply is fast, and keep the
  // chatbot in lockstep with the app-wide Online/Offline switch.
  // -> OFFLINE: drop any in-flight reply, pin status to offline, local engine only.
  // -> back ONLINE: clear the notice and re-check the live AI.
  // Both branches live in one effect so a single warm-up request is made.
  useEffect(() => {
    if (isForcedOffline) {
      genIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsStreaming(false);
      setStreamingText('');
      setAiStatus('offline');
      setAiNotice(
        t('chat_offline_mode', 'Offline mode is on â€” answering from the built-in on-device knowledge base. Switch the network back to Online for full live AI.')
      );
      return;
    }

    setAiNotice(null);
    setAiStatus('checking');
    warmUpProvider().then(ok => {
      setAiStatus(ok ? 'online' : 'offline');
    });
    // Intentionally keyed on the switch alone: depending on `t`/`aiStatus`
    // would re-fire the AI warm-up request on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForcedOffline]);

  // Update initial message when language changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'm-init') {
        return [{
          id: 'm-init',
          sender: 'bot',
          text: getGreeting(currentLanguage),
          timestamp: 'Just now'
        }];
      }
      return prev;
    });
  }, [currentLanguage, getGreeting]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, streamingText, isStreaming]);

  // Stop any active speech and recognition on unmount
  useEffect(() => {
    return () => {
      voiceRecognitionService.abort();
      textToSpeechService.stop();
    };
  }, []);

  // Text-to-Speech (TTS) synthesizer in the current language
  const speakText = (text: string) => {
    const res = textToSpeechService.speak(text, currentLanguage, {
      onStart: () => setVoiceState('SPEAKING'),
      onEnd: () => setVoiceState('IDLE'),
      onError: () => setVoiceState('IDLE')
    });

    if (!res.success) {
      if (res.reason === 'NO_NATIVE_VOICE') {
        setVoiceNotice({
          message: t('voice_no_native_tts', res.message || 'Native voice engine for this language is not installed on this device. Displaying text response below.'),
          canRetryVoices: false
        });
      } else if (res.reason === 'UNSUPPORTED') {
        setVoiceNotice({
          message: t('voice_status_unsupported', 'Voice output is not supported in this browser. Please view text response.'),
          canRetryVoices: false
        });
      }
      setVoiceState('IDLE');
    } else {
      setVoiceNotice(null);
    }
  };

  const stopSpeaking = () => {
    textToSpeechService.stop();
    setVoiceState(prev => (prev === 'SPEAKING' ? 'IDLE' : prev));
  };

  const handleRetryVoices = () => {
    if (textToSpeechService.hasNativeVoiceFor(currentLanguage)) {
      setVoiceNotice(null);
    }
  };

  // Map and Direction Action Handlers with exact coordinates centering
  const handleOpenInMap = (action?: LocationAction) => {
    if (action?.lat && action?.lng) {
      setFocusedMapLocation({
        lat: action.lat,
        lng: action.lng,
        title: action.title,
        address: action.address,
        zoom: 15
      });
    }
    setCurrentView('DISASTER_MAP');
  };

  const handleGetDirections = (action?: LocationAction) => {
    if (action?.routeId) {
      const foundRoute = evacuationRoutes.find(r => r.id === action.routeId);
      if (foundRoute) {
        setActiveEvacuationRoute(foundRoute);
      }
    } else if (action?.lat && action?.lng) {
      if (evacuationRoutes.length > 0) {
        setActiveEvacuationRoute(evacuationRoutes[0]);
      }
    }
    setCurrentView('SHELTER_EVACUATION');
  };

  const handleClearChat = () => {
    stopSpeaking();
    // Abort any in-flight AI generation and reset streaming UI
    genIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingText('');
    setVoiceState('IDLE');
    setMessages([
      {
        id: `m-${Date.now()}`,
        sender: 'bot',
        text: getGreeting(currentLanguage),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Open the chat and make sure the AI model is warm for an instant first reply
  const openChat = () => {
    setIsOpen(true);
    if (isForcedOffline) return; // no network calls while offline
    if (isAiOnline() !== true) {
      warmUpProvider().then(ok => {
        setAiStatus(ok ? 'online' : 'offline');
      });
    }
  };

  // Re-check the AI connection from the offline notice banner
  const retryAi = () => {
    if (isForcedOffline) return; // the network switch is off â€” nothing to retry
    setAiNotice(null);
    setAiStatus('checking');
    warmUpProvider().then(ok => {
      setAiStatus(ok ? 'online' : 'offline');
    });
  };

  // Dynamic multilingual response generator
  const generateBotResponse = (query: string, lang: SupportedLanguage): BotResponseResult => {
    const q = query.toLowerCase();
    const activeSOS = sosReports.filter(r => r.status === 'PENDING' || r.status === 'TRIAGED');
    const criticalSOS = activeSOS.filter(r => r.priorityLevel === 'CRITICAL');
    const totalFreeBeds = shelters.reduce((acc, s) => acc + (s.totalCapacity - s.currentOccupancy), 0);
    const topShelter = shelters[0];

    // 0. QUICK CHIP DIRECT MATCHING (All 6 Languages)
    const q1Matches = [
      'what is the current risk', 'à®¤à®±à¯à®ªà¯‹à®¤à¯ˆà®¯ à®†à®ªà®¤à¯à®¤à¯ à®¨à®¿à®²à¯ˆ à®Žà®©à¯à®©', 'à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤œà¥‹à¤–à¤¿à¤® à¤¸à¥à¤¤à¤° à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ',
      'à°ªà±à°°à°¸à±à°¤à±à°¤ à°ªà±à°°à°®à°¾à°¦ à°¸à±à°¥à°¾à°¯à°¿ à°à°®à°¿à°Ÿà°¿', 'à´¨à´¿à´²à´µà´¿à´²àµ† à´…à´ªà´•à´Ÿ à´¸à´¾à´§àµà´¯à´¤ à´Žà´¤àµà´°à´¯à´¾à´£àµ', 'à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¦à§à¦°à§à¦¯à§‹à¦—à§‡à¦° à¦à§à¦à¦•à¦¿ à¦•à§‡à¦®à¦¨'
    ];
    const q2Matches = [
      'where is the nearest safe shelter', 'à®…à®°à¯à®•à®¿à®²à¯à®³à¯à®³ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®© à®®à¯à®•à®¾à®®à¯ à®Žà®™à¯à®•à¯‡ à®‰à®³à¯à®³à®¤à¯', 'à¤¨à¤¿à¤•à¤Ÿà¤¤à¤® à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤†à¤¶à¥à¤°à¤¯ à¤•à¤¹à¤¾à¤‚ à¤¹à¥ˆ',
      'à°¸à°®à±€à°ªà°‚à°²à±‹à°¨à°¿ à°¸à±à°°à°•à±à°·à°¿à°¤ à°†à°¶à±à°°à°¯à°‚ à°Žà°•à±à°•à°¡ à°‰à°‚à°¦à°¿', 'à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³ à´¸àµà´°à´•àµà´·à´¿à´¤ à´•àµà´¯à´¾à´®àµà´ªàµ à´Žà´µà´¿à´Ÿàµ†à´¯à´¾à´£àµ', 'à¦¨à¦¿à¦•à¦Ÿà¦¬à¦°à§à¦¤à§€ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦° à¦•à§‹à¦¥à¦¾à¦¯à¦¼'
    ];
    const q3Matches = [
      'how many active incidents are there', 'à®Žà®¤à¯à®¤à®©à¯ˆ à®…à®µà®šà®°à®šà¯ à®šà®®à¯à®ªà®µà®™à¯à®•à®³à¯ à®ªà®¤à®¿à®µà®¾à®•à®¿à®¯à¯à®³à¯à®³à®©', 'à¤•à¤¿à¤¤à¤¨à¥€ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤˜à¤Ÿà¤¨à¤¾à¤à¤‚ à¤¹à¥ˆà¤‚',
      'à°Žà°¨à±à°¨à°¿ à°•à±à°°à°¿à°¯à°¾à°¶à±€à°² à°…à°¤à±à°¯à°µà°¸à°° à°¸à°‚à°˜à°Ÿà°¨à°²à± à°‰à°¨à±à°¨à°¾à°¯à°¿', 'à´Žà´¤àµà´° à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¸à´‚à´­à´µà´™àµà´™àµ¾ à´±à´¿à´ªàµà´ªàµ‹àµ¼à´Ÿàµà´Ÿàµ à´šàµ†à´¯àµà´¤à´¿à´Ÿàµà´Ÿàµà´£àµà´Ÿàµ', 'à¦•à¦¤à¦—à§à¦²à¦¿ à¦¸à¦•à§à¦°à¦¿à¦¯à¦¼ à¦˜à¦Ÿà¦¨à¦¾ à¦°à¦¯à¦¼à§‡à¦›à§‡'
    ];
    const q4Matches = [
      'which shelters have available capacity', 'à®Žà®¨à¯à®¤ à®®à¯à®•à®¾à®®à¯à®•à®³à®¿à®²à¯ à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ à®‰à®³à¯à®³à®©', 'à¤•à¤¿à¤¨ à¤¶à¤¿à¤µà¤¿à¤°à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¬à¤¿à¤¸à¥à¤¤à¤° à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¤‚',
      'à° à°†à°¶à±à°°à°¯à°¾à°²à°²à±‹ à°¬à±†à°¡à±à°²à± à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°¨à±à°¨à°¾à°¯à°¿', 'à´à´¤àµŠà´•àµà´•àµ† à´•àµà´¯à´¾à´®àµà´ªàµà´•à´³à´¿àµ½ à´¸àµà´¥à´²à´¸àµ—à´•à´°àµà´¯à´®àµà´£àµà´Ÿàµ', 'à¦•à§‹à¦¨ à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦°à§‡ à¦–à¦¾à¦²à¦¿ à¦œà¦¾à¦¯à¦¼à¦—à¦¾ à¦†à¦›à§‡'
    ];
    const q5Matches = [
      'what is the river water level', 'à®†à®±à¯à®±à¯ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ à®Žà®µà¯à®µà®³à®µà¯', 'à¤¨à¤¦à¥€ à¤•à¤¾ à¤œà¤²à¤¸à¥à¤¤à¤° à¤•à¤¿à¤¤à¤¨à¤¾ à¤¹à¥ˆ',
      'à°¨à°¦à°¿ à°¨à±€à°Ÿà°¿ à°®à°Ÿà±à°Ÿà°‚ à°Žà°‚à°¤', 'à´¨à´¦à´¿à´¯à´¿à´²àµ† à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ à´Žà´¤àµà´°à´¯à´¾à´£àµ', 'à¦¨à¦¦à§€à¦° à¦ªà¦¾à¦¨à¦¿à¦° à¦‰à¦šà§à¦šà¦¤à¦¾ à¦•à¦¤'
    ];

    // 1. SPECIFIC QUERY: "Where is Pragati High School Relief Camp?"
    const isPragati = q.includes('pragati') || q.includes('à®ªà®¿à®°à®•à®¤à®¿') || q.includes('à¤ªà¥à¤°à¤—à¤¤à¤¿') ||
                      q.includes('à°ªà±à°°à°—à°¤à°¿') || q.includes('à´ªàµà´°à´—à´¤à´¿') || q.includes('à¦ªà§à¦°à¦—à¦¤à¦¿');

    if (isPragati) {
      const locAction: LocationAction = {
        type: 'shelter',
        title: 'Pragati High School Relief Camp',
        lat: 26.158,
        lng: 91.698,
        address: 'Maligaon Gate No. 3, Guwahati',
        routeId: 'ROUTE-PANDU-01'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®ªà®¿à®°à®•à®¤à®¿ à®‰à®¯à®°à¯à®¨à®¿à®²à¯ˆà®ªà¯ à®ªà®³à¯à®³à®¿ à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯ à®•à¯à®µà®¹à®¾à®¤à¯à®¤à®¿ à®®à®¾à®²à®¿à®•à®¾à®µà¯ à®•à¯‡à®Ÿà¯ à®Žà®£à¯ 3 à®‡à®²à¯ à®…à®®à¯ˆà®¨à¯à®¤à¯à®³à¯à®³à®¤à¯. à®‡à®¤à®¿à®²à¯ à®¤à®±à¯à®ªà¯‹à®¤à¯ 128 à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ (à®‡à®°à¯à®ªà¯à®ªà¯: 322/450) à®‰à®³à¯à®³à®©. 24x7 à®…à®µà®šà®° à®®à®°à¯à®¤à¯à®¤à¯à®µà®•à¯ à®•à¯‚à®Ÿà®¾à®°à®®à¯, 1,420 à®‰à®£à®µà¯à®ªà¯ à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ 3,400 à®²à®¿à®Ÿà¯à®Ÿà®°à¯ à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯ à®¤à®¯à®¾à®°à¯ à®¨à®¿à®²à¯ˆà®¯à®¿à®²à¯ à®‰à®³à¯à®³à®©. à®ªà®¾à®£à¯à®Ÿà¯ à®•à®¾à®Ÿà¯ à®ªà®•à¯à®¤à®¿à®¯à®¿à®²à®¿à®°à¯à®¨à¯à®¤à¯ 2.1 à®•à®¿.à®®à¯€ à®¤à¯Šà®²à¯ˆà®µà®¿à®²à¯ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®© à®®à¯‡à®Ÿà¯à®Ÿà¯à®ªà¯à®ªà®¾à®¤à¯ˆà®¯à®¿à®²à¯ à®šà¯†à®²à¯à®²à®²à®¾à®®à¯.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤ªà¥à¤°à¤—à¤¤à¤¿ à¤¹à¤¾à¤ˆ à¤¸à¥à¤•à¥‚à¤² à¤°à¤¾à¤¹à¤¤ à¤¶à¤¿à¤µà¤¿à¤° à¤®à¤¾à¤²à¥€à¤—à¤¾à¤‚à¤µ à¤—à¥‡à¤Ÿ à¤¨à¤‚à¤¬à¤° 3, à¤—à¥à¤µà¤¾à¤¹à¤¾à¤Ÿà¥€ à¤®à¥‡à¤‚ à¤¸à¥à¤¥à¤¿à¤¤ à¤¹à¥ˆà¥¤ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤¯à¤¹à¤¾à¤ 128 à¤–à¤¾à¤²à¥€ à¤¬à¤¿à¤¸à¥à¤¤à¤° (322/450 à¤…à¤§à¤¿à¤­à¥‹à¤—) à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¤‚à¥¤ à¤¯à¤¹à¤¾à¤ 24x7 à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤Ÿà¥‡à¤‚à¤Ÿ, 1,420 à¤­à¥‹à¤œà¤¨ à¤ªà¥ˆà¤•à¥‡à¤Ÿ à¤”à¤° 3,400 à¤²à¥€à¤Ÿà¤° à¤ªà¥‡à¤¯à¤œà¤² à¤•à¥€ à¤¸à¥à¤µà¤¿à¤§à¤¾ à¤¹à¥ˆà¥¤ à¤ªà¤¾à¤‚à¤¡à¥ à¤˜à¤¾à¤Ÿ à¤¸à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤Šà¤‚à¤šà¥‡ à¤®à¤¾à¤°à¥à¤— à¤¸à¥‡ à¤¦à¥‚à¤°à¥€ 2.1 à¤•à¤¿à¤®à¥€ à¤¹à¥ˆà¥¤`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°ªà±à°°à°—à°¤à°¿ à°¹à±ˆà°¸à±à°•à±‚à°²à± à°°à°¿à°²à±€à°«à± à°•à±à°¯à°¾à°‚à°ªà± à°®à°¾à°²à°¿à°—à°¾à°µà± à°—à±‡à°Ÿà± à°¨à°‚. 3, à°—à±Œà°¹à°¤à°¿ à°µà°¦à±à°¦ à°‰à°‚à°¦à°¿. à°‡à°•à±à°•à°¡ à°ªà±à°°à°¸à±à°¤à±à°¤à°‚ 128 à°–à°¾à°³à±€ à°¬à±†à°¡à±à°²à± (322/450 à°¨à°¿à°‚à°¡à°¿à°¨à°µà°¿) à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°¨à±à°¨à°¾à°¯à°¿. 24x7 à°…à°¤à±à°¯à°µà°¸à°° à°µà±ˆà°¦à±à°¯ à°¶à°¿à°¬à°¿à°°à°‚, 1,420 à°†à°¹à°¾à°° à°ªà±à°¯à°¾à°•à±†à°Ÿà±à°²à± à°®à°°à°¿à°¯à± 3,400 à°²à±€à°Ÿà°°à±à°² à°¤à°¾à°—à±à°¨à±€à°°à± à°¸à°¿à°¦à±à°§à°‚à°—à°¾ à°‰à°¨à±à°¨à°¾à°¯à°¿. à°ªà°¾à°‚à°¡à± à°˜à°¾à°Ÿà± à°¨à±à°‚à°¡à°¿ à°¸à±à°°à°•à±à°·à°¿à°¤ à°Žà°¤à±à°¤à±ˆà°¨ à°®à°¾à°°à±à°—à°‚à°²à±‹ à°¦à±‚à°°à°‚ 2.1 à°•à°¿.à°®à±€.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´ªàµà´°à´—à´¤à´¿ à´¹àµˆà´¸àµà´•àµ‚àµ¾ à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´•àµà´¯à´¾à´®àµà´ªàµ à´—àµà´µà´¾à´¹à´¤àµà´¤à´¿ à´®à´¾à´²à´¿à´—à´¾à´µàµ à´—àµ‡à´±àµà´±àµ à´¨à´®àµà´ªàµ¼ 3-àµ½ à´¸àµà´¥à´¿à´¤à´¿ à´šàµ†à´¯àµà´¯àµà´¨àµà´¨àµ. à´¨à´¿à´²à´µà´¿àµ½ à´‡à´µà´¿à´Ÿàµ† 128 à´’à´´à´¿à´µàµà´³àµà´³ à´¬àµ†à´¡àµà´•à´³àµà´£àµà´Ÿàµ (322/450 à´†àµ¾à´•àµà´•à´¾àµ¼). 24x7 à´®àµ†à´¡à´¿à´•àµà´•àµ½ à´Ÿàµ†à´¨àµà´±àµ, 1,420 à´­à´•àµà´·à´£ à´ªà´¾à´•àµà´•à´±àµà´±àµà´•àµ¾, 3,400 à´²à´¿à´±àµà´±àµ¼ à´•àµà´Ÿà´¿à´µàµ†à´³àµà´³à´‚ à´Žà´¨àµà´¨à´¿à´µ à´¸à´œàµà´œàµ€à´•à´°à´¿à´šàµà´šà´¿à´°à´¿à´•àµà´•àµà´¨àµà´¨àµ. à´ªà´¾à´£àµà´¡àµ à´˜à´¾à´Ÿàµà´Ÿà´¿àµ½ à´¨à´¿à´¨àµà´¨àµ à´¸àµà´°à´•àµà´·à´¿à´¤ à´ªà´¾à´¤ à´µà´´à´¿ 2.1 à´•à´¿.à´®àµ€ à´¦àµ‚à´°à´®àµà´£àµà´Ÿàµ.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦ªà§à¦°à¦—à¦¤à¦¿ à¦¹à¦¾à¦‡ à¦¸à§à¦•à§à¦² à¦¤à§à¦°à¦¾à¦£ à¦¶à¦¿à¦¬à¦¿à¦°à¦Ÿà¦¿ à¦—à§à¦¯à¦¼à¦¾à¦¹à¦¾à¦Ÿà¦¿à¦° à¦®à¦¾à¦²à¦¿à¦—à¦¾à¦à¦“ à¦—à§‡à¦Ÿ à¦¨à¦®à§à¦¬à¦° à§© à¦ à¦…à¦¬à¦¸à§à¦¥à¦¿à¦¤à¥¤ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨à§‡ à¦à¦–à¦¾à¦¨à§‡ à§§à§¨à§®à¦Ÿà¦¿ à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾ à¦°à¦¯à¦¼à§‡à¦›à§‡ (à§©à§¨à§¨/à§ªà§«à§¦ à¦…à¦§à¦¿à¦•à§ƒà¦¤)à¥¤ à¦à¦–à¦¾à¦¨à§‡ à§¨à§ªxà§­ à¦œà¦°à§à¦°à¦¿ à¦®à§‡à¦¡à¦¿à¦•à§‡à¦² à¦¤à¦¾à¦à¦¬à§, à§§,à§ªà§¨à§¦à¦Ÿà¦¿ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà§à¦¯à¦¾à¦•à§‡à¦Ÿ à¦à¦¬à¦‚ à§©,à§ªà§¦à§¦ à¦²à¦¿à¦Ÿà¦¾à¦° à¦ªà¦¾à¦¨à§€à¦¯à¦¼ à¦œà¦² à¦‰à¦ªà¦²à¦¬à§à¦§à¥¤ à¦ªà¦¾à¦¨à§à¦¡à§ à¦˜à¦¾à¦Ÿ à¦¥à§‡à¦•à§‡ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦‰à¦à¦šà§ à¦¸à¦¡à¦¼à¦• à¦¦à¦¿à¦¯à¦¼à§‡ à¦¦à§‚à¦°à¦¤à§à¦¬ à§¨.à§§ à¦•à¦¿à¦®à¦¿à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `Pragati High School Relief Camp is located at Maligaon Gate No. 3, Guwahati. It currently has 128 free beds (322/450 occupied, 36 reserved). Facilities include an active 24x7 medical triaging tent, 1,420 food packets, and 3,400L potable water. Walking distance is 2.1 km (12 mins) from Pandu Ghat via elevated ridge route.`,
            locationAction: locAction
          };
      }
    }

    // 1b. SPECIFIC QUERY: "Where is Cotton Collegiate Relief Centre?"
    const isCotton = q.includes('cotton') || q.includes('collegiate') || q.includes('à®•à®¾à®Ÿà¯à®Ÿà®©à¯') ||
                     q.includes('à¤•à¥‰à¤Ÿà¤¨') || q.includes('à°•à°¾à°Ÿà°¨à±') || q.includes('à´•àµ‹à´Ÿàµà´Ÿàµº') || q.includes('à¦•à¦Ÿà¦¨');

    if (isCotton) {
      const locAction: LocationAction = {
        type: 'shelter',
        title: 'Cotton Collegiate Relief Centre',
        lat: 26.186,
        lng: 91.748,
        address: 'Panbazar High Ground, Guwahati',
        routeId: 'ROUTE-FANCY-02'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®•à®¾à®Ÿà¯à®Ÿà®©à¯ à®•à®¾à®²à¯‡à®œà®¿à®¯à¯‡à®Ÿà¯ à®¨à®¿à®µà®¾à®°à®£ à®®à¯ˆà®¯à®®à¯ à®ªà®¾à®©à¯à®ªà®œà®¾à®°à¯ à®®à¯‡à®Ÿà¯à®Ÿà¯ à®¨à®¿à®²à®ªà¯à®ªà®°à®ªà¯à®ªà®¿à®²à¯ à®…à®®à¯ˆà®¨à¯à®¤à¯à®³à¯à®³à®¤à¯ (à®®à¯à®•à®µà®°à®¿: Panbazar High Ground, Guwahati). à®‡à®¤à®¿à®²à¯ à®¤à®±à¯à®ªà¯‹à®¤à¯ 90 à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ (à®‡à®°à¯à®ªà¯à®ªà¯: 510/600) à®‰à®³à¯à®³à®©. à®…à®µà®šà®° à®®à®°à¯à®¤à¯à®¤à¯à®µ à®®à¯ˆà®¯à®®à¯, 280 à®‰à®£à®µà¯à®ªà¯ à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ 750 à®²à®¿à®Ÿà¯à®Ÿà®°à¯ à®šà¯à®¤à¯à®¤à®¿à®•à®°à®¿à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿ à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯ à®¤à®¯à®¾à®°à¯ à®¨à®¿à®²à¯ˆà®¯à®¿à®²à¯ à®‰à®³à¯à®³à®©.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤•à¥‰à¤Ÿà¤¨ à¤•à¥‰à¤²à¥‡à¤œà¤¿à¤à¤Ÿ à¤°à¤¾à¤¹à¤¤ à¤•à¥‡à¤‚à¤¦à¥à¤° à¤ªà¤¾à¤¨à¤¬à¤¾à¤œà¤¾à¤° à¤¹à¤¾à¤ˆ à¤—à¥à¤°à¤¾à¤‰à¤‚à¤¡, à¤—à¥à¤µà¤¾à¤¹à¤¾à¤Ÿà¥€ à¤®à¥‡à¤‚ à¤¸à¥à¤¥à¤¿à¤¤ à¤¹à¥ˆà¥¤ à¤¯à¤¹à¤¾à¤ 90 à¤–à¤¾à¤²à¥€ à¤¬à¤¿à¤¸à¥à¤¤à¤° (510/600 à¤…à¤§à¤¿à¤­à¥‹à¤—) à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¤‚à¥¤ à¤•à¥‡à¤‚à¤¦à¥à¤° à¤®à¥‡à¤‚ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤¯à¥‚à¤¨à¤¿à¤Ÿ, 280 à¤­à¥‹à¤œà¤¨ à¤ªà¥ˆà¤•à¥‡à¤Ÿ à¤”à¤° 750 à¤²à¥€à¤Ÿà¤° à¤ªà¥‡à¤¯à¤œà¤² à¤•à¥€ à¤¸à¥à¤µà¤¿à¤§à¤¾ à¤¹à¥ˆà¥¤ à¤«à¥ˆà¤‚à¤¸à¥€ à¤¬à¤¾à¤œà¤¾à¤° à¤¸à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤®à¤¾à¤°à¥à¤— à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¥¤`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°•à°¾à°Ÿà°¨à± à°•à°¾à°²à±‡à°œà°¿à°¯à±‡à°Ÿà± à°°à°¿à°²à±€à°«à± à°¸à±†à°‚à°Ÿà°°à± à°ªà°¾à°¨à±â€Œà°¬à°œà°¾à°°à± à°¹à±ˆ à°—à±à°°à±Œà°‚à°¡à±, à°—à±Œà°¹à°¤à°¿ à°µà°¦à±à°¦ à°‰à°‚à°¦à°¿. à°‡à°•à±à°•à°¡ 90 à°–à°¾à°³à±€ à°¬à±†à°¡à±à°²à± (510/600 à°¨à°¿à°‚à°¡à°¿à°¨à°µà°¿) à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°¨à±à°¨à°¾à°¯à°¿. à°®à±†à°¡à°¿à°•à°²à± à°¸à°¦à±à°ªà°¾à°¯à°‚, 280 à°†à°¹à°¾à°° à°ªà±à°¯à°¾à°•à±†à°Ÿà±à°²à± à°®à°°à°¿à°¯à± 750 à°²à±€à°Ÿà°°à±à°² à°¤à°¾à°—à±à°¨à±€à°°à± à°¸à°¿à°¦à±à°§à°‚à°—à°¾ à°‰à°¨à±à°¨à°¾à°¯à°¿.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´•àµ‹à´Ÿàµà´Ÿàµº à´•àµŠà´³àµ€à´œà´¿à´¯à´±àµà´±àµ à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´•àµ‡à´¨àµà´¦àµà´°à´‚ à´ªà´¾àµ»à´¬à´¸à´¾àµ¼ à´¹àµˆ à´—àµà´°àµ—à´£àµà´Ÿà´¿àµ½ à´¸àµà´¥à´¿à´¤à´¿ à´šàµ†à´¯àµà´¯àµà´¨àµà´¨àµ. à´¨à´¿à´²à´µà´¿àµ½ 90 à´’à´´à´¿à´µàµà´³àµà´³ à´¬àµ†à´¡àµà´•à´³àµà´£àµà´Ÿàµ (510/600 à´†à´³àµà´•àµ¾). à´®àµ†à´¡à´¿à´•àµà´•àµ½ à´Ÿàµ€à´®àµà´‚ 280 à´­à´•àµà´·à´£ à´ªà´¾à´•àµà´•à´±àµà´±àµà´•à´³àµà´‚ 750 à´²à´¿à´±àµà´±àµ¼ à´•àµà´Ÿà´¿à´µàµ†à´³àµà´³à´µàµà´‚ à´‡à´µà´¿à´Ÿàµ† à´²à´­àµà´¯à´®à´¾à´£àµ.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦•à¦Ÿà¦¨ à¦•à¦²à§‡à¦œà¦¿à¦¯à¦¼à§‡à¦Ÿ à¦¤à§à¦°à¦¾à¦£ à¦•à§‡à¦¨à§à¦¦à§à¦°à¦Ÿà¦¿ à¦ªà¦¾à¦¨à¦¬à¦¾à¦œà¦¾à¦° à¦¹à¦¾à¦‡ à¦—à§à¦°à¦¾à¦‰à¦¨à§à¦¡, à¦—à§à¦¯à¦¼à¦¾à¦¹à¦¾à¦Ÿà¦¿à¦¤à§‡ à¦…à¦¬à¦¸à§à¦¥à¦¿à¦¤à¥¤ à¦à¦–à¦¾à¦¨à§‡ à§¯à§¦à¦Ÿà¦¿ à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾ à¦°à¦¯à¦¼à§‡à¦›à§‡ (à§«à§§à§¦/à§¬à§¦à§¦ à¦…à¦§à¦¿à¦•à§ƒà¦¤)à¥¤ à¦à¦¤à§‡ à¦œà¦°à§à¦°à¦¿ à¦®à§‡à¦¡à¦¿à¦•à§‡à¦² à¦‡à¦‰à¦¨à¦¿à¦Ÿ, à§¨à§®à§¦à¦Ÿà¦¿ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà§à¦¯à¦¾à¦•à§‡à¦Ÿ à¦à¦¬à¦‚ à§­à§«à§¦ à¦²à¦¿à¦Ÿà¦¾à¦° à¦ªà¦¾à¦¨à§€à¦¯à¦¼ à¦œà¦² à¦®à¦œà§à¦¤ à¦°à¦¯à¦¼à§‡à¦›à§‡à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `Cotton Collegiate Relief Centre is situated at Panbazar High Ground, Guwahati. It has 90 free beds available (510/600 occupied, 45 reserved). Facilities include an on-site medical unit, 280 meal packets, and 750L of purified drinking water.`,
            locationAction: locAction
          };
      }
    }

    // 1c. SPECIFIC QUERY: "Where is the incident?" / "Show me the incident on the map"
    const isIncidentLocation = (q.includes('where') && (q.includes('incident') || q.includes('sos') || q.includes('trapped') || q.includes('rescue'))) ||
                               (q.includes('location') && (q.includes('incident') || q.includes('sos'))) ||
                               q.includes('à®šà®®à¯à®ªà®µà®®à¯ à®Žà®™à¯à®•à¯‡') || q.includes('à®šà®®à¯à®ªà®µà®¤à¯à®¤à®¿à®©à¯ à®‡à®°à¯à®ªà¯à®ªà®¿à®Ÿà®®à¯') || q.includes('à®®à®•à¯à®•à®³à¯ à®Žà®™à¯à®•à¯‡') ||
                               q.includes('à¤˜à¤Ÿà¤¨à¤¾ à¤•à¤¹à¤¾à¤') || q.includes('à¤˜à¤Ÿà¤¨à¤¾ à¤•à¤¹à¤¾à¤‚') || q.includes('à¤²à¥‹à¤— à¤•à¤¹à¤¾à¤‚') ||
                               q.includes('à°¸à°‚à°˜à°Ÿà°¨ à°Žà°•à±à°•à°¡') || q.includes('à°ªà±à°°à°œà°²à± à°Žà°•à±à°•à°¡') ||
                               q.includes('à´¸à´‚à´­à´µà´‚ à´Žà´µà´¿à´Ÿàµ†') || q.includes('à´†à´³àµà´•àµ¾ à´Žà´µà´¿à´Ÿàµ†') ||
                               q.includes('à¦˜à¦Ÿà¦¨à¦¾ à¦•à§‹à¦¥à¦¾à¦¯à¦¼') || q.includes('à¦•à§‹à¦¥à¦¾à¦¯à¦¼ à¦®à¦¾à¦¨à§à¦·');

    if (isIncidentLocation) {
      const topIncident = activeSOS[0] || sosReports[0];
      const locAction: LocationAction = {
        type: 'map',
        title: `${topIncident.id}: ${topIncident.locationName}`,
        lat: topIncident.lat,
        lng: topIncident.lng,
        address: topIncident.locationName,
        routeId: 'ROUTE-PANDU-01'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®®à¯à®•à¯à®•à®¿à®¯ à®…à®µà®šà®° à®šà®®à¯à®ªà®µà®®à¯: ${topIncident.id} â€” ${topIncident.locationName}. à®¤à®±à¯à®ªà¯‹à®¤à¯ˆà®¯ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ ${topIncident.waterLevelMeters} à®®à¯€. à®‡à®¤à®¿à®²à¯ ${topIncident.peopleCount} à®¨à®ªà®°à¯à®•à®³à¯ (à®®à¯à®¤à®¿à®¯à®µà®°à¯ à®‰à®Ÿà¯à®ªà®Ÿ) à®šà®¿à®•à¯à®•à®¿à®¯à¯à®³à¯à®³à®©à®°à¯. à®…à®µà®šà®° à®®à¯à®©à¯à®©à¯à®°à®¿à®®à¯ˆ à®®à®¤à®¿à®ªà¯à®ªà¯†à®£à¯: ${topIncident.priorityScore}/100. NDRF à®®à¯€à®Ÿà¯à®ªà¯à®ªà¯ à®ªà®Ÿà®•à¯ à®…à®©à¯à®ªà¯à®ªà®ªà¯à®ªà®Ÿà¯à®Ÿà¯à®³à¯à®³à®¤à¯.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤ªà¥à¤°à¤®à¥à¤– à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤˜à¤Ÿà¤¨à¤¾: ${topIncident.id} â€” ${topIncident.locationName} à¤ªà¤° à¤¸à¥à¤¥à¤¿à¤¤ à¤¹à¥ˆà¥¤ à¤¯à¤¹à¤¾à¤ à¤¬à¤¾à¤¢à¤¼ à¤•à¤¾ à¤œà¤²à¤¸à¥à¤¤à¤° ${topIncident.waterLevelMeters} à¤®à¥€à¤Ÿà¤° à¤¹à¥ˆ à¤”à¤° ${topIncident.peopleCount} à¤¨à¤¾à¤—à¤°à¤¿à¤• à¤«à¤‚à¤¸à¥‡ à¤¹à¥ˆà¤‚à¥¤ à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾ à¤¸à¥à¤•à¥‹à¤°: ${topIncident.priorityScore}/100à¥¤ à¤à¤¨à¤¡à¥€à¤†à¤°à¤à¤« à¤®à¥‹à¤Ÿà¤°à¤¬à¥‹à¤Ÿ à¤­à¥‡à¤œà¥€ à¤œà¤¾ à¤šà¥à¤•à¥€ à¤¹à¥ˆà¥¤`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°®à±à°–à±à°¯ à°…à°¤à±à°¯à°µà°¸à°° à°¸à°‚à°˜à°Ÿà°¨: ${topIncident.id} â€” ${topIncident.locationName} à°µà°¦à±à°¦ à°‰à°‚à°¦à°¿. à°µà°°à°¦ à°¨à±€à°Ÿà°¿ à°®à°Ÿà±à°Ÿà°‚ ${topIncident.waterLevelMeters} à°®à±€à°Ÿà°°à±à°²à± à°®à°°à°¿à°¯à± ${topIncident.peopleCount} à°®à°‚à°¦à°¿ à°šà°¿à°•à±à°•à±à°•à±à°¨à±à°¨à°¾à°°à±. à°ªà±à°°à°¾à°§à°¾à°¨à±à°¯à°¤ à°¸à±à°•à±‹à°°à±: ${topIncident.priorityScore}/100. à°Žà°¨à±à°¡à±€à°†à°°à±à°Žà°«à± à°¬à±ƒà°‚à°¦à°‚ à°ªà°‚à°ªà°¬à°¡à°¿à°‚à°¦à°¿.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´ªàµà´°à´§à´¾à´¨ à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¸à´‚à´­à´µà´‚: ${topIncident.id} â€” ${topIncident.locationName}-àµ½ à´¸àµà´¥à´¿à´¤à´¿ à´šàµ†à´¯àµà´¯àµà´¨àµà´¨àµ. à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ ${topIncident.waterLevelMeters} à´®àµ€à´±àµà´±à´±à´¾à´£àµ, ${topIncident.peopleCount} à´ªàµ‡àµ¼ à´•àµà´Ÿàµà´™àµà´™à´¿à´•àµà´•à´¿à´Ÿà´•àµà´•àµà´¨àµà´¨àµ. à´®àµàµ»à´—à´£à´¨à´¾ à´¸àµà´•àµ‹àµ¼: ${topIncident.priorityScore}/100. NDRF à´¬àµ‹à´Ÿàµà´Ÿàµ à´…à´¯à´šàµà´šà´¿à´Ÿàµà´Ÿàµà´£àµà´Ÿàµ.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦ªà§à¦°à¦§à¦¾à¦¨ à¦œà¦°à§à¦°à¦¿ à¦˜à¦Ÿà¦¨à¦¾: ${topIncident.id} â€” ${topIncident.locationName} à¦ à¦…à¦¬à¦¸à§à¦¥à¦¿à¦¤à¥¤ à¦ªà¦¾à¦¨à¦¿à¦° à¦‰à¦šà§à¦šà¦¤à¦¾ ${topIncident.waterLevelMeters} à¦®à¦¿à¦Ÿà¦¾à¦° à¦à¦¬à¦‚ ${topIncident.peopleCount} à¦œà¦¨ à¦†à¦Ÿà¦•à¦¾ à¦ªà¦¡à¦¼à§‡à¦›à§‡à¦¨à¥¤ à¦œà¦°à§à¦°à¦¿ à¦…à¦—à§à¦°à¦¾à¦§à¦¿à¦•à¦¾à¦° à¦¸à§à¦•à§‹à¦°: ${topIncident.priorityScore}/à§§à§¦à§¦à¥¤ à¦à¦¨à¦¡à¦¿à¦†à¦°à¦à¦« à¦‰à¦¦à§à¦§à¦¾à¦°à¦•à¦¾à¦°à§€ à¦¬à§‹à¦Ÿ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `Critical incident ${topIncident.id} is located at ${topIncident.locationName} (Coordinates: ${topIncident.lat}Â° N, ${topIncident.lng}Â° E). Floodwater depth is ${topIncident.waterLevelMeters}m with ${topIncident.peopleCount} trapped citizens. Priority score is ${topIncident.priorityScore}/100 (CRITICAL). NDRF Column Alpha has been dispatched.`,
            locationAction: locAction
          };
      }
    }

    // 2. SPECIFIC QUERY: "Where is the nearest hospital?"
    const isHospital = q.includes('hospital') || q.includes('clinic') || q.includes('doctor') || q.includes('gmch') ||
                       q.includes('à®®à®°à¯à®¤à¯à®¤à¯à®µà®®à®©à¯ˆ') || q.includes('à®…à®¸à¯à®ªà®¤à¯à®¤à®¿à®°à®¿') ||
                       q.includes('à¤…à¤¸à¥à¤ªà¤¤à¤¾à¤²') || q.includes('à¤šà¤¿à¤•à¤¿à¤¤à¥à¤¸à¤¾à¤²à¤¯') ||
                       q.includes('à°†à°¸à±à°ªà°¤à±à°°à°¿') || q.includes('à°†à°¸à±à°ªà°¤à±à°°à°¿') ||
                       q.includes('à´†à´¶àµà´ªà´¤àµà´°à´¿') ||
                       q.includes('à¦¹à¦¾à¦¸à¦ªà¦¾à¦¤à¦¾à¦²') || q.includes('à¦¡à¦¾à¦•à§à¦¤à¦¾à¦°à¦–à¦¾à¦¨à¦¾');

    if (isHospital) {
      const locAction: LocationAction = {
        type: 'hospital',
        title: 'Gauhati Medical College & Hospital (GMCH)',
        lat: 26.155,
        lng: 91.770,
        address: 'Bhangagarh Emergency Complex, Guwahati'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®…à®°à¯à®•à®¿à®²à¯à®³à¯à®³ à®®à¯à®•à¯à®•à®¿à®¯ à®®à®°à¯à®¤à¯à®¤à¯à®µà®®à®©à¯ˆ à®•à®µà¯à®•à®¾à®¤à¯à®¤à®¿ à®®à®°à¯à®¤à¯à®¤à¯à®µà®•à¯ à®•à®²à¯à®²à¯‚à®°à®¿ & à®®à®°à¯à®¤à¯à®¤à¯à®µà®®à®©à¯ˆ (GMCH), à®ªà®¾à®™à¯à®•à®¾à®•à®°à¯ à®…à®µà®šà®° à®µà®³à®¾à®•à®¤à¯à®¤à®¿à®²à¯ à®‰à®³à¯à®³à®¤à¯. à®‡à®¤à®¿à®²à¯ 142 à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ (18 à®¤à¯€à®µà®¿à®° à®šà®¿à®•à®¿à®šà¯à®šà¯ˆà®ªà¯ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ à®‰à®Ÿà¯à®ªà®Ÿ), à®…à®µà®šà®° à®¹à¯†à®²à®¿à®ªà¯‡à®Ÿà¯ à®®à®±à¯à®±à¯à®®à¯ 14 à®µà¯†à®³à¯à®³ à®†à®®à¯à®ªà¯à®²à®©à¯à®¸à¯à®•à®³à¯ à®¤à®¯à®¾à®°à¯ à®¨à®¿à®²à¯ˆà®¯à®¿à®²à¯ à®‰à®³à¯à®³à®©. à®…à®µà®šà®° à®…à®´à¯ˆà®ªà¯à®ªà¯: 108 / +91 361 2529457.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤¨à¤¿à¤•à¤Ÿà¤¤à¤® à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤…à¤¸à¥à¤ªà¤¤à¤¾à¤² à¤—à¥Œà¤¹à¤¾à¤Ÿà¥€ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤•à¥‰à¤²à¥‡à¤œ à¤”à¤° à¤…à¤¸à¥à¤ªà¤¤à¤¾à¤² (GMCH) à¤¹à¥ˆ, à¤œà¥‹ à¤­à¤‚à¤—à¤¾à¤—à¤¢à¤¼ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤ªà¤°à¤¿à¤¸à¤° à¤®à¥‡à¤‚ à¤¸à¥à¤¥à¤¿à¤¤ à¤¹à¥ˆà¥¤ à¤‡à¤¸à¤®à¥‡à¤‚ 142 à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¬à¤¿à¤¸à¥à¤¤à¤° (18 à¤†à¤ˆà¤¸à¥€à¤¯à¥‚ à¤¬à¥‡à¤¡ à¤¸à¤¹à¤¿à¤¤), à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤¹à¥‡à¤²à¥€à¤ªà¥ˆà¤¡ à¤”à¤° 14 à¤¸à¥à¤Ÿà¥ˆà¤‚à¤¡à¤¬à¤¾à¤¯ à¤à¤®à¥à¤¬à¥à¤²à¥‡à¤‚à¤¸ à¤¹à¥ˆà¤‚à¥¤ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤¸à¤‚à¤ªà¤°à¥à¤•: 108 / +91 361 2529457.`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°¸à°®à±€à°ª à°…à°¤à±à°¯à°µà°¸à°° à°†à°¸à±à°ªà°¤à±à°°à°¿ à°—à±Œà°¹à°¤à°¿ à°®à±†à°¡à°¿à°•à°²à± à°•à°¾à°²à±‡à°œà± & à°¹à°¾à°¸à±à°ªà°¿à°Ÿà°²à± (GMCH), à°­à°‚à°—à°—à°¢à± à°Žà°®à°°à±à°œà±†à°¨à±à°¸à±€ à°•à°¾à°‚à°ªà±à°²à±†à°•à±à°¸à± à°µà°¦à±à°¦ à°‰à°‚à°¦à°¿. à°‡à°•à±à°•à°¡ 142 à°…à°‚à°¦à±à°¬à°¾à°Ÿà± à°¬à±†à°¡à±à°²à± (18 à°à°¸à±€à°¯à±‚ à°¬à±†à°¡à±à°²à± à°¸à°¹à°¾), à°Žà°®à°°à±à°œà±†à°¨à±à°¸à±€ à°¹à±†à°²à°¿à°ªà±à°¯à°¾à°¡à± à°®à°°à°¿à°¯à± 14 à°…à°‚à°¬à±à°²à±†à°¨à±à°¸à±à°²à± à°¸à°¿à°¦à±à°§à°‚à°—à°¾ à°‰à°¨à±à°¨à°¾à°¯à°¿. à°…à°¤à±à°¯à°µà°¸à°° à°«à±‹à°¨à±: 108 / +91 361 2529457.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´à´±àµà´±à´µàµà´‚ à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³ à´Žà´®àµ¼à´œàµ»à´¸à´¿ à´†à´¶àµà´ªà´¤àµà´°à´¿ à´­à´‚à´—à´¾à´—à´¡àµ à´•àµ‹à´‚à´ªàµà´²à´•àµà´¸à´¿à´²àµà´³àµà´³ à´—àµà´µà´¾à´¹à´¤àµà´¤à´¿ à´®àµ†à´¡à´¿à´•àµà´•àµ½ à´•àµ‹à´³àµ‡à´œàµ & à´¹àµ‹à´¸àµà´ªà´¿à´±àµà´±àµ½ (GMCH) à´†à´£àµ. à´‡à´µà´¿à´Ÿàµ† 142 à´¬àµ†à´¡àµà´•à´³àµà´‚ (18 à´à´¸à´¿à´¯àµ à´¬àµ†à´¡àµà´•àµ¾ à´‰àµ¾à´ªàµà´ªàµ†à´Ÿàµ†), à´¹àµ†à´²à´¿à´ªà´¾à´¡àµà´‚ 14 à´†à´‚à´¬àµà´²àµ»à´¸àµà´•à´³àµà´‚ à´²à´­àµà´¯à´®à´¾à´£àµ. à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¨à´®àµà´ªàµ¼: 108 / +91 361 2529457.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦¨à¦¿à¦•à¦Ÿà¦¤à¦® à¦œà¦°à§à¦°à¦¿ à¦¹à¦¾à¦¸à¦ªà¦¾à¦¤à¦¾à¦²à¦Ÿà¦¿ à¦¹à¦²à§‹ à¦­à¦¾à¦¨à¦—à¦¾à¦—à¦¡à¦¼ à¦‡à¦®à¦¾à¦°à§à¦œà§‡à¦¨à§à¦¸à¦¿ à¦•à¦®à¦ªà§à¦²à§‡à¦•à§à¦¸à§‡ à¦…à¦¬à¦¸à§à¦¥à¦¿à¦¤ à¦—à§Œà¦¹à¦¾à¦Ÿà¦¿ à¦®à§‡à¦¡à¦¿à¦•à§‡à¦² à¦•à¦²à§‡à¦œ à¦“ à¦¹à¦¾à¦¸à¦ªà¦¾à¦¤à¦¾à¦² (GMCH)à¥¤ à¦à¦¤à§‡ à§§à§ªà§¨à¦Ÿà¦¿ à¦¶à¦¯à§à¦¯à¦¾ (à§§à§®à¦Ÿà¦¿ à¦†à¦‡à¦¸à¦¿à¦‡à¦‰ à¦¬à§‡à¦¡ à¦¸à¦¹), à¦œà¦°à§à¦°à¦¿ à¦¹à§‡à¦²à¦¿à¦ªà§à¦¯à¦¾à¦¡ à¦à¦¬à¦‚ à§§à§ªà¦Ÿà¦¿ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦¨à§à¦¡à¦¬à¦¾à¦‡ à¦…à§à¦¯à¦¾à¦®à§à¦¬à§à¦²à§‡à¦¨à§à¦¸ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤ à¦°à¦¯à¦¼à§‡à¦›à§‡à¥¤ à¦œà¦°à§à¦°à¦¿ à¦¹à§‡à¦²à§à¦ªà¦²à¦¾à¦‡à¦¨: à§§à§¦à§® / +à§¯à§§ à§©à§¬à§§ à§¨à§«à§¨à§¯à§ªà§«à§­à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `The nearest tertiary care hospital is Gauhati Medical College & Hospital (GMCH) located at Bhangagarh Emergency Complex. It has 142 available beds (including 18 ICU trauma beds), an active Emergency Helipad, and 14 standby flood rescue ambulances. Emergency Helpline: 108 / +91 361 2529457.`,
            locationAction: locAction
          };
      }
    }

    // 3. SPECIFIC QUERY: "Show me the evacuation route" / "safe route" / "corridor"
    const isRoute = (q.includes('evacuat') || q.includes('route') || q.includes('direction') || q.includes('corridor') || q.includes('path') ||
                     q.includes('à®ªà®¾à®¤à¯ˆ') || q.includes('à®µà®´à®¿') || q.includes('à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®²à¯') ||
                     q.includes('à¤®à¤¾à¤°à¥à¤—') || q.includes('à¤°à¤¾à¤¸à¥à¤¤à¤¾') || q.includes('à¤¦à¤¿à¤¶à¤¾') ||
                     q.includes('à°¦à°¾à°°à°¿') || q.includes('à°®à°¾à°°à±à°—à°‚') ||
                     q.includes('à´®à´¾àµ¼à´—àµà´—à´‚') ||
                     q.includes('à¦ªà¦¥') || q.includes('à¦¦à¦¿à¦•à¦¨à¦¿à¦°à§à¦¦à§‡à¦¶')) &&
                    !q.includes('capacity') && !q.includes('bed') && !q.includes('à®ªà®Ÿà¯à®•à¯à®•à¯ˆ') && !q.includes('à¤¬à¤¿à¤¸à¥à¤¤à¤°') && !q.includes('à°¬à±†à°¡à±');

    if (isRoute) {
      const locAction: LocationAction = {
        type: 'route',
        title: 'Safe Route: Pandu Ghat to Pragati High School',
        lat: 26.178,
        lng: 91.702,
        routeId: 'ROUTE-PANDU-01'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®šà®°à®¿à®ªà®¾à®°à¯à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®© à®µà¯†à®³à®¿à®¯à¯‡à®±à¯à®±à®ªà¯ à®ªà®¾à®¤à¯ˆ: à®®à®£à¯à®Ÿà®²à®®à¯ A (à®ªà®¾à®£à¯à®Ÿà¯ à®•à®¾à®Ÿà¯) à®®à¯à®¤à®²à¯ à®ªà®¿à®°à®•à®¤à®¿ à®ªà®³à¯à®³à®¿ à®®à¯à®•à®¾à®®à¯ à®µà®°à¯ˆ (à®ªà®¾à®¤à¯ˆ à®Žà®£à¯: ROUTE-PANDU-01). à®¤à¯‚à®°à®®à¯: 2.1 à®•à®¿.à®®à¯€ (à®¨à®Ÿà®•à¯à®•à¯à®®à¯ à®¨à¯‡à®°à®®à¯: 12 à®¨à®¿à®®à®¿à®Ÿà®™à¯à®•à®³à¯). à®¨à®¿à®²à¯ˆ: à®µà®±à®£à¯à®Ÿ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®© à®ªà®¾à®¤à¯ˆ (+18 à®®à¯€ à®®à¯‡à®Ÿà¯à®Ÿà¯ à®¨à®¿à®²à®ªà¯à®ªà®°à®ªà¯à®ªà¯). à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®²à¯: à®†à®±à¯à®±à¯ à®•à®°à¯ˆà®¯à¯ˆ à®µà®¿à®Ÿà¯à®Ÿà¯ à®¤à¯†à®±à¯à®•à¯‡ à®šà¯†à®©à¯à®±à¯ à®®à®¾à®²à®¿à®•à®¾à®µà¯ à®®à¯‡à®²à¯ à®®à¯à®•à®Ÿà¯à®Ÿà¯ˆà®ªà¯ à®ªà®¯à®©à¯à®ªà®Ÿà¯à®¤à¯à®¤à®µà¯à®®à¯; à®®à®¾à®²à®¿à®•à®¾à®µà¯ à®•à¯‡à®Ÿà¯ 3 à®‡à®²à¯ à®•à®¿à®´à®•à¯à®•à¯‡ à®¤à®¿à®°à¯à®®à¯à®ªà®µà¯à®®à¯. à®µà¯†à®³à¯à®³à®®à¯ à®šà¯‚à®´à¯à®¨à¯à®¤ à®ªà®¾à®£à¯à®Ÿà¯ à®µà®¯à®Ÿà®•à¯à®Ÿà¯ˆà®¤à¯ à®¤à®µà®¿à®°à¯à®•à¯à®•à®µà¯à®®à¯.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¨à¤¿à¤•à¤¾à¤¸à¥€ à¤—à¤²à¤¿à¤¯à¤¾à¤°à¤¾: à¤œà¤¼à¥‹à¤¨ A (à¤ªà¤¾à¤‚à¤¡à¥ à¤˜à¤¾à¤Ÿ) à¤¸à¥‡ à¤ªà¥à¤°à¤—à¤¤à¤¿ à¤¹à¤¾à¤ˆ à¤¸à¥à¤•à¥‚à¤² à¤°à¤¾à¤¹à¤¤ à¤¶à¤¿à¤µà¤¿à¤° à¤¤à¤• (à¤®à¤¾à¤°à¥à¤—: ROUTE-PANDU-01)à¥¤ à¤¦à¥‚à¤°à¥€: 2.1 à¤•à¤¿à¤®à¥€ (à¤…à¤¨à¥à¤®à¤¾à¤¨à¤¿à¤¤ à¤¸à¤®à¤¯: 12 à¤®à¤¿à¤¨à¤Ÿ)à¥¤ à¤¸à¥à¤¥à¤¿à¤¤à¤¿: à¤¸à¥‚à¤–à¤¾ à¤µ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤—à¤²à¤¿à¤¯à¤¾à¤°à¤¾ (+18 à¤®à¥€à¤Ÿà¤° à¤Šà¤‚à¤šà¤¾à¤ˆ)à¥¤ à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶: à¤¨à¤¦à¥€ à¤¤à¤Ÿà¤¬à¤‚à¤§ à¤¸à¥‡ à¤¦à¥‚à¤° à¤¦à¤•à¥à¤·à¤¿à¤£ à¤•à¥€ à¤“à¤° à¤šà¤²à¥‡à¤‚, à¤®à¤¾à¤²à¥€à¤—à¤¾à¤‚à¤µ à¤Šà¤ªà¤°à¥€ à¤°à¤¿à¤œ à¤®à¤¾à¤°à¥à¤— à¤²à¥‡à¤‚ à¤”à¤° à¤—à¥‡à¤Ÿ à¤¨à¤‚à¤¬à¤° 3 à¤ªà¤° à¤ªà¥‚à¤°à¥à¤µ à¤•à¥€ à¤“à¤° à¤®à¥à¤¡à¤¼à¥‡à¤‚à¥¤ à¤œà¤²à¤­à¤°à¤¾à¤µ à¤µà¤¾à¤²à¥‡ à¤µà¤¿à¤¯à¤¾à¤¡à¤•à¥à¤Ÿ à¤¸à¥‡ à¤¬à¤šà¥‡à¤‚à¥¤`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°§à±ƒà°µà±€à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°¨ à°¸à±à°°à°•à±à°·à°¿à°¤ à°¤à°°à°²à°¿à°‚à°ªà± à°®à°¾à°°à±à°—à°‚: à°œà±‹à°¨à± A (à°ªà°¾à°‚à°¡à± à°˜à°¾à°Ÿà±) à°¨à±à°‚à°¡à°¿ à°ªà±à°°à°—à°¤à°¿ à°¹à±ˆà°¸à±à°•à±‚à°²à± à°•à±à°¯à°¾à°‚à°ªà± à°µà°°à°•à± (à°°à±‚à°Ÿà±: ROUTE-PANDU-01). à°¦à±‚à°°à°‚: 2.1 à°•à°¿.à°®à±€ (à°¸à±à°®à°¾à°°à± 12 à°¨à°¿à°®à°¿à°·à°¾à°²à±). à°¸à±à°¥à°¿à°¤à°¿: à°¸à±à°°à°•à±à°·à°¿à°¤ à°Žà°¤à±à°¤à±ˆà°¨ à°•à°¾à°°à°¿à°¡à°¾à°°à± (+18 à°®à±€à°Ÿà°°à±à°² à°Žà°¤à±à°¤à±). à°¸à±‚à°šà°¨à°²à±: à°¨à°¦à°¿ à°•à°Ÿà±à°Ÿ à°¨à±à°‚à°¡à°¿ à°¦à°•à±à°·à°¿à°£ à°¦à°¿à°¶à°—à°¾ à°µà±†à°³à±à°²à°¿, à°®à°¾à°²à°¿à°—à°¾à°µà± à°Žà°¤à±à°¤à±ˆà°¨ à°°à±‹à°¡à±à°¡à± à°—à±à°‚à°¡à°¾ à°—à±‡à°Ÿà± à°¨à°‚. 3 à°µà°¦à±à°¦ à°¤à±‚à°°à±à°ªà±à°•à± à°¤à°¿à°°à°—à°‚à°¡à°¿.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´¸àµà´°à´•àµà´·à´¿à´¤ à´’à´´à´¿à´ªàµà´ªà´¿à´•àµà´•àµ½ à´ªà´¾à´¤: à´¸àµ‹àµº A (à´ªà´¾à´£àµà´¡àµ à´˜à´¾à´Ÿàµà´Ÿàµ) à´®àµà´¤àµ½ à´ªàµà´°à´—à´¤à´¿ à´¹àµˆà´¸àµà´•àµ‚àµ¾ à´•àµà´¯à´¾à´®àµà´ªàµ à´µà´°àµ† (à´±àµ‚à´Ÿàµà´Ÿàµ: ROUTE-PANDU-01). à´¦àµ‚à´°à´‚: 2.1 à´•à´¿.à´®àµ€ (à´à´•à´¦àµ‡à´¶à´‚ 12 à´®à´¿à´¨à´¿à´±àµà´±àµ). à´¨à´¿à´²: à´µàµ†à´³àµà´³à´ªàµà´ªàµŠà´•àµà´•à´®à´¿à´²àµà´²à´¾à´¤àµà´¤ à´¸àµà´°à´•àµà´·à´¿à´¤ à´ªà´¾à´¤ (+18 à´®àµ€à´±àµà´±àµ¼ à´‰à´¯à´°à´‚). à´¨à´¿àµ¼à´¦àµà´¦àµ‡à´¶à´‚: à´¨à´¦àµ€à´¤àµ€à´°à´¤àµà´¤àµ à´¨à´¿à´¨àµà´¨àµ à´¤àµ†à´•àµà´•àµ‹à´Ÿàµà´Ÿàµ à´®à´¾à´±à´¿ à´®à´¾à´²à´¿à´—à´¾à´µàµ à´…à´ªàµà´ªàµ¼ à´±à´¿à´¡àµà´œàµ à´µà´´à´¿ à´¸à´žàµà´šà´°à´¿à´šàµà´šàµ à´—àµ‡à´±àµà´±àµ 3-àµ½ à´•à´¿à´´à´•àµà´•àµ‹à´Ÿàµà´Ÿàµ à´¤à´¿à´°à´¿à´¯àµà´•.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦¯à¦¾à¦šà¦¾à¦‡à¦•à§ƒà¦¤ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦¸à§à¦¥à¦¾à¦¨à¦¾à¦¨à§à¦¤à¦° à¦•à¦°à¦¿à¦¡à§‹à¦°: à¦œà§‹à¦¨ A (à¦ªà¦¾à¦¨à§à¦¡à§ à¦˜à¦¾à¦Ÿ) à¦¥à§‡à¦•à§‡ à¦ªà§à¦°à¦—à¦¤à¦¿ à¦¹à¦¾à¦‡ à¦¸à§à¦•à§à¦² à¦¤à§à¦°à¦¾à¦£ à¦¶à¦¿à¦¬à¦¿à¦° à¦ªà¦°à§à¦¯à¦¨à§à¦¤ (à¦°à§à¦Ÿ: ROUTE-PANDU-01)à¥¤ à¦¦à§‚à¦°à¦¤à§à¦¬: à§¨.à§§ à¦•à¦¿à¦®à¦¿ (à¦†à¦¨à§à¦®à¦¾à¦¨à¦¿à¦• à¦¸à¦®à¦¯à¦¼: à§§à§¨ à¦®à¦¿à¦¨à¦¿à¦Ÿ)à¥¤ à¦…à¦¬à¦¸à§à¦¥à¦¾: à¦¶à§à¦·à§à¦• à¦“ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦‰à¦à¦šà§ à¦•à¦°à¦¿à¦¡à§‹à¦° (+à§§à§® à¦®à¦¿à¦Ÿà¦¾à¦° à¦‰à¦šà§à¦šà¦¤à¦¾)à¥¤ à¦¨à¦¿à¦°à§à¦¦à§‡à¦¶à¦¨à¦¾: à¦¨à¦¦à§€ à¦¬à¦¾à¦à¦§ à¦¥à§‡à¦•à§‡ à¦¦à¦•à§à¦·à¦¿à¦£à§‡ à¦¸à¦°à§‡ à¦®à¦¾à¦²à¦¿à¦—à¦¾à¦à¦“ à¦†à¦ªà¦¾à¦° à¦°à¦¿à¦œ à¦§à¦°à§‡ à¦à¦—à¦¿à¦¯à¦¼à§‡ à¦—à§‡à¦Ÿ à¦¨à¦‚ à§© à¦ à¦ªà§‚à¦°à§à¦¬ à¦¦à¦¿à¦•à§‡ à¦®à§‹à¦¡à¦¼ à¦¨à¦¿à¦¨à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `Verified Safe Evacuation Corridor: Route ROUTE-PANDU-01 from Zone A (Pandu Ghat) to Pragati High School Relief Camp. Distance: 2.1 km (Estimated walking time: 12 minutes). Status: DRY CORRIDOR SAFE (+18m MSL high ridge). Instructions: Depart Pandu Temple Road South away from the river embankment, follow Maligaon Upper Ridge, and turn East at Gate 3. Avoid Pandu Link Viaduct.`,
            locationAction: locAction
          };
      }
    }

    // 4. NEAREST SHELTER / "Where is the nearest safe shelter?" / "What is the address of the relief camp?" / "Show the nearest safe shelter"
    const isNearest = q2Matches.some(m => q.includes(m.toLowerCase())) ||
                      q.includes('à®¤à®™à¯à®•à¯à®®à®¿à®Ÿ') || q.includes('à®¤à®™à¯à®•à¯à®®à®¿à®Ÿà®®à¯') ||
                      ((q.includes('nearest') || q.includes('how far') || q.includes('where') || q.includes('show') || q.includes('give') || q.includes('direction') || q.includes('address') ||
                        q.includes('à®…à®°à¯à®•à®¿à®²à¯') || q.includes('à®Žà®™à¯à®•à¯‡') || q.includes('à®•à®¾à®Ÿà¯à®Ÿà¯') || q.includes('à®®à¯à®•à®µà®°à®¿') ||
                        q.includes('à¤¨à¤¿à¤•à¤Ÿà¤¤à¤®') || q.includes('à¤ªà¤¾à¤¸') || q.includes('à¤•à¤¹à¤¾à¤') || q.includes('à¤•à¤¹à¤¾') || q.includes('à¤¦à¤¿à¤–à¤¾') || q.includes('à¤ªà¤¤à¤¾') ||
                        q.includes('à°¸à°®à±€à°ª') || q.includes('à°Žà°•à±à°•à°¡') || q.includes('à°šà±‚à°ª') || q.includes('à°šà°¿à°°à±à°¨à°¾à°®à°¾') ||
                        q.includes('à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³') || q.includes('à´Žà´µà´¿à´Ÿàµ†') || q.includes('à´•à´¾à´£à´¿à´•àµà´•àµà´•') || q.includes('à´µà´¿à´²à´¾à´¸à´‚') ||
                        q.includes('à¦¨à¦¿à¦•à¦Ÿà¦¬à¦°à§à¦¤à§€') || q.includes('à¦•à§‹à¦¥à¦¾à¦¯à¦¼') || q.includes('à¦¦à§‡à¦–à¦¾à¦¨') || q.includes('à¦ à¦¿à¦•à¦¾à¦¨à¦¾')) &&
                       (q.includes('shelter') || q.includes('camp') || q.includes('relief') || q.includes('safe') ||
                        q.includes('à®®à¯à®•à®¾à®®à¯') || q.includes('à®†à®šà®¿à®°à®®à®®à¯') || q.includes('à®¤à®™à¯à®•à¯à®®à®¿à®Ÿà®®à¯') ||
                        q.includes('à¤†à¤¶à¥à¤°à¤¯') || q.includes('à¤¶à¤¿à¤µà¤¿à¤°') || q.includes('à¤°à¤¾à¤¹à¤¤') ||
                        q.includes('à°†à°¶à±à°°à°¯à°‚') || q.includes('à°ªà±à°¨à°°à°¾à°µà°¾à°¸') ||
                        q.includes('à´•àµà´¯à´¾à´®àµà´ªàµ') || q.includes('à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸') ||
                        q.includes('à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦°') || q.includes('à¦¤à§à¦°à¦¾à¦£')));

    if (isNearest) {
      const locAction: LocationAction = {
        type: 'shelter',
        title: topShelter.name,
        lat: topShelter.lat,
        lng: topShelter.lng,
        address: topShelter.address,
        routeId: 'ROUTE-PANDU-01'
      };

      switch (lang) {
        case 'ta':
          return {
            text: `à®…à®°à¯à®•à®¿à®²à¯à®³à¯à®³ à®šà®°à®¿à®ªà®¾à®°à¯à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿ à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯: ${topShelter.name}.\nà®®à¯à®•à®µà®°à®¿: ${topShelter.address} (à®…à®šà¯à®šà¯à®°à¯‡à®•à¯ˆ: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E).\nà®¤à¯‚à®°à®®à¯: à®ªà®¾à®£à¯à®Ÿà¯ à®ªà®•à¯à®¤à®¿à®¯à®¿à®²à®¿à®°à¯à®¨à¯à®¤à¯ 2.1 à®•à®¿.à®®à¯€ (à®µà®±à®£à¯à®Ÿ à®ªà®¾à®¤à¯ˆ à®µà®´à®¿à®¯à®¾à®• 12 à®¨à®¿à®®à®¿à®Ÿà®™à¯à®•à®³à¯ à®¨à®Ÿà¯ˆà®ªà¯à®ªà®¯à®£à®®à¯).\nà®•à¯Šà®³à¯à®³à®³à®µà¯: ${topShelter.totalCapacity - topShelter.currentOccupancy} à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ (à®‡à®°à¯à®ªà¯à®ªà¯: ${topShelter.currentOccupancy}/${topShelter.totalCapacity}, à®’à®¤à¯à®•à¯à®•à¯€à®Ÿà¯: ${topShelter.reservedSpaces}).\nà®µà®šà®¤à®¿à®•à®³à¯: 24x7 à®®à®°à¯à®¤à¯à®¤à¯à®µà®•à¯ à®•à¯‚à®Ÿà®¾à®°à®®à¯, ${topShelter.resources.foodPackets} à®‰à®£à®µà¯à®ªà¯ à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯, ${topShelter.resources.waterLiters}L à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯ à®¤à®¯à®¾à®°à¯.`,
            locationAction: locAction
          };
        case 'hi':
          return {
            text: `à¤¨à¤¿à¤•à¤Ÿà¤¤à¤® à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤¾à¤¹à¤¤ à¤¶à¤¿à¤µà¤¿à¤°: ${topShelter.name}.\nà¤ªà¤¤à¤¾: ${topShelter.address} (à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶à¤¾à¤‚à¤•: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E).\nà¤¦à¥‚à¤°à¥€: à¤ªà¤¾à¤‚à¤¡à¥ à¤˜à¤¾à¤Ÿ à¤¸à¥‡ 2.1 à¤•à¤¿à¤®à¥€ (à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤Šà¤‚à¤šà¥‡ à¤®à¤¾à¤°à¥à¤— à¤¸à¥‡ 12 à¤®à¤¿à¤¨à¤Ÿ à¤ªà¥ˆà¤¦à¤²).\nà¤•à¥à¤·à¤®à¤¤à¤¾: ${topShelter.totalCapacity - topShelter.currentOccupancy} à¤–à¤¾à¤²à¥€ à¤¬à¤¿à¤¸à¥à¤¤à¤° (à¤…à¤§à¤¿à¤­à¥‹à¤—: ${topShelter.currentOccupancy}/${topShelter.totalCapacity}, à¤†à¤°à¤•à¥à¤·à¤¿à¤¤: ${topShelter.reservedSpaces}).\nà¤¸à¥à¤µà¤¿à¤§à¤¾à¤à¤‚: 24x7 à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤Ÿà¥‡à¤‚à¤Ÿ, ${topShelter.resources.foodPackets} à¤­à¥‹à¤œà¤¨ à¤ªà¥ˆà¤•à¥‡à¤Ÿ à¤”à¤° ${topShelter.resources.waterLiters} à¤²à¥€à¤Ÿà¤° à¤ªà¥‡à¤¯à¤œà¤² à¤‰à¤ªà¤²à¤¬à¥à¤§à¥¤`,
            locationAction: locAction
          };
        case 'te':
          return {
            text: `à°¸à°®à±€à°ªà°‚à°²à±‹à°¨à°¿ à°§à±ƒà°µà±€à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°¨ à°¸à±à°°à°•à±à°·à°¿à°¤ à°†à°¶à±à°°à°¯à°‚: ${topShelter.name}.\nà°šà°¿à°°à±à°¨à°¾à°®à°¾: ${topShelter.address} (à°•à±‹à°†à°°à±à°¡à°¿à°¨à±‡à°Ÿà±à°²à±: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E).\nà°¦à±‚à°°à°‚: à°ªà°¾à°‚à°¡à± à°˜à°¾à°Ÿà± à°¨à±à°‚à°¡à°¿ 2.1 à°•à°¿.à°®à±€ (à°Žà°¤à±à°¤à±ˆà°¨ à°®à°¾à°°à±à°—à°‚à°²à±‹ 12 à°¨à°¿à°®à°¿à°·à°¾à°²à±).\nà°¸à°¾à°®à°°à±à°¥à±à°¯à°‚: ${topShelter.totalCapacity - topShelter.currentOccupancy} à°–à°¾à°³à±€ à°¬à±†à°¡à±à°²à± (à°¨à°¿à°‚à°¡à°¿à°¨à°µà°¿: ${topShelter.currentOccupancy}/${topShelter.totalCapacity}, à°°à°¿à°œà°°à±à°µà±: ${topShelter.reservedSpaces}).\nà°¸à°¦à±à°ªà°¾à°¯à°¾à°²à±: 24x7 à°…à°¤à±à°¯à°µà°¸à°° à°µà±ˆà°¦à±à°¯ à°¶à°¿à°¬à°¿à°°à°‚, ${topShelter.resources.foodPackets} à°†à°¹à°¾à°° à°ªà±à°¯à°¾à°•à±†à°Ÿà±à°²à±, ${topShelter.resources.waterLiters}L à°¤à°¾à°—à±à°¨à±€à°°à±.`,
            locationAction: locAction
          };
        case 'ml':
          return {
            text: `à´à´±àµà´±à´µàµà´‚ à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³ à´¸àµà´°à´•àµà´·à´¿à´¤ à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´•àµà´¯à´¾à´®àµà´ªàµ: ${topShelter.name}.\nà´µà´¿à´²à´¾à´¸à´‚: ${topShelter.address} (à´•àµ‹àµ¼à´¡à´¿à´¨àµ‡à´±àµà´±àµà´•àµ¾: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E).\nà´¦àµ‚à´°à´‚: à´ªà´¾à´£àµà´¡àµà´µà´¿àµ½ à´¨à´¿à´¨àµà´¨àµ 2.1 à´•à´¿.à´®àµ€ (à´¸àµà´°à´•àµà´·à´¿à´¤ à´ªà´¾à´¤ à´µà´´à´¿ 12 à´®à´¿à´¨à´¿à´±àµà´±àµ à´•à´¾àµ½à´¨à´Ÿ à´¯à´¾à´¤àµà´°).\nà´¸àµ—à´•à´°àµà´¯à´‚: ${topShelter.totalCapacity - topShelter.currentOccupancy} à´’à´´à´¿à´µàµà´³àµà´³ à´¬àµ†à´¡àµà´•àµ¾ (à´†à´•àµ†: ${topShelter.currentOccupancy}/${topShelter.totalCapacity}, à´®à´¾à´±àµà´±à´¿à´µàµ†à´šàµà´šà´¤àµ: ${topShelter.reservedSpaces}).\nà´¸à´œàµà´œàµ€à´•à´°à´£à´™àµà´™àµ¾: 24x7 à´®àµ†à´¡à´¿à´•àµà´•àµ½ à´Ÿàµ†à´¨àµà´±àµ, ${topShelter.resources.foodPackets} à´­à´•àµà´·à´£ à´ªà´¾à´•àµà´•à´±àµà´±àµà´•àµ¾, ${topShelter.resources.waterLiters}L à´•àµà´Ÿà´¿à´µàµ†à´³àµà´³à´‚.`,
            locationAction: locAction
          };
        case 'bn':
          return {
            text: `à¦¨à¦¿à¦•à¦Ÿà¦¬à¦°à§à¦¤à§€ à¦¯à¦¾à¦šà¦¾à¦‡à¦•à§ƒà¦¤ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦¤à§à¦°à¦¾à¦£ à¦¶à¦¿à¦¬à¦¿à¦°: ${topShelter.name}à¥¤\nà¦ à¦¿à¦•à¦¾à¦¨à¦¾: ${topShelter.address} (à¦¸à§à¦¥à¦¾à¦¨à¦¾à¦™à§à¦•: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E)à¥¤\nà¦¦à§‚à¦°à¦¤à§à¦¬: à¦ªà¦¾à¦¨à§à¦¡à§ à¦˜à¦¾à¦Ÿ à¦¥à§‡à¦•à§‡ à§¨.à§§ à¦•à¦¿à¦®à¦¿ (à¦‰à¦à¦šà§ à¦•à¦°à¦¿à¦¡à§‹à¦° à¦¦à¦¿à¦¯à¦¼à§‡ à§§à§¨ à¦®à¦¿à¦¨à¦¿à¦Ÿà§‡à¦° à¦¹à¦¾à¦à¦Ÿà¦¾ à¦ªà¦¥)à¥¤\nà¦§à¦¾à¦°à¦£à¦•à§à¦·à¦®à¦¤à¦¾: ${topShelter.totalCapacity - topShelter.currentOccupancy}à¦Ÿà¦¿ à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾ (à¦…à¦§à¦¿à¦•à§ƒà¦¤: ${topShelter.currentOccupancy}/${topShelter.totalCapacity}, à¦¸à¦‚à¦°à¦•à§à¦·à¦¿à¦¤: ${topShelter.reservedSpaces})à¥¤\nà¦¸à§à¦¯à§‹à¦—-à¦¸à§à¦¬à¦¿à¦§à¦¾: à§¨à§ªxà§­ à¦®à§‡à¦¡à¦¿à¦•à§‡à¦² à¦¤à¦¾à¦à¦¬à§, ${topShelter.resources.foodPackets}à¦Ÿà¦¿ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà§à¦¯à¦¾à¦•à§‡à¦Ÿ à¦“ ${topShelter.resources.waterLiters} à¦²à¦¿à¦Ÿà¦¾à¦° à¦ªà¦¾à¦¨à§€à¦¯à¦¼ à¦œà¦² à¦‰à¦ªà¦²à¦¬à§à¦§à¥¤`,
            locationAction: locAction
          };
        case 'en':
        default:
          return {
            text: `Nearest verified safe relief shelter: ${topShelter.name}.\nAddress: ${topShelter.address} (Coordinates: ${topShelter.lat}Â° N, ${topShelter.lng}Â° E).\nDistance: 2.1 km (12 mins walk via elevated dry corridor from Pandu Ghat).\nCapacity: ${topShelter.totalCapacity - topShelter.currentOccupancy} free beds (${topShelter.currentOccupancy}/${topShelter.totalCapacity} occupied, ${topShelter.reservedSpaces} reserved).\nFacilities: 24x7 active medical triaging tent, ${topShelter.resources.foodPackets} food packets, and ${topShelter.resources.waterLiters}L potable water.`,
            locationAction: locAction
          };
      }
    }

    // 5. GREETING / WELCOME / ASSIST
    const isGreeting = (/\b(hello|hi|hey|help)\b/i.test(q) || q.includes('who are you') ||
                       q.includes('à®µà®£à®•à¯à®•à®®à¯') || q.includes('à®¹à®²à¯‹') ||
                       q.includes('à¤¨à¤®à¤¸à¥à¤¤à¥‡') || q.includes('à¤¨à¤®à¤¸à¥à¤•à¤¾à¤°') ||
                       q.includes('à°¨à°®à°¸à±à°•à°¾à°°à°‚') || q.includes('à°¹à°²à±‹') ||
                       q.includes('à´¨à´®à´¸àµà´•à´¾à´°à´‚') || q.includes('à´¹à´²àµ‹') ||
                       q.includes('à¦¨à¦®à¦¸à§à¦•à¦¾à¦°') || q.includes('à¦¹à§à¦¯à¦¾à¦²à§‹')) && q.length < 35;

    if (isGreeting && q.length < 25) {
      switch (lang) {
        case 'ta':
          return { text: `à®µà®£à®•à¯à®•à®®à¯! à®¨à®¾à®©à¯ NEXORA AI à®ªà¯‡à®°à®¿à®Ÿà®°à¯ à®®à¯‡à®²à®¾à®£à¯à®®à¯ˆ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®¿. à®¨à®¾à®©à¯ à®‰à®™à¯à®•à®³à¯à®•à¯à®•à¯ à®¤à®±à¯à®ªà¯‹à®¤à¯ˆà®¯ à®µà¯†à®³à¯à®³ à®…à®ªà®¾à®¯ à®¨à®¿à®²à¯ˆ, à®…à®°à¯à®•à®¿à®²à¯à®³à¯à®³ à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯à®•à®³à¯, à®†à®±à¯à®±à¯ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ à®®à®±à¯à®±à¯à®®à¯ à®…à®µà®šà®° à®‰à®¤à®µà®¿ à®Žà®£à¯à®•à®³à¯ à®•à¯à®±à®¿à®¤à¯à®¤ à®‰à®Ÿà®©à®Ÿà®¿à®¤à¯ à®¤à®•à®µà®²à¯à®•à®³à¯ˆ à®µà®´à®™à¯à®• à®®à¯à®Ÿà®¿à®¯à¯à®®à¯. à®‰à®™à¯à®•à®³à¯ à®•à¯‡à®³à¯à®µà®¿à®¯à¯ˆà®•à¯ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯.` };
        case 'hi':
          return { text: `à¤¨à¤®à¤¸à¥à¤¤à¥‡! à¤®à¥ˆà¤‚ NEXORA AI à¤†à¤ªà¤¦à¤¾ à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾ à¤¸à¤¹à¤¾à¤¯à¤• à¤¹à¥‚à¤‚à¥¤ à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¥‹ à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¸à¤®à¤¯ à¤¬à¤¾à¤¢à¤¼ à¤œà¥‹à¤–à¤¿à¤®, à¤¨à¤¿à¤•à¤Ÿà¤¤à¤® à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤†à¤¶à¥à¤°à¤¯, à¤¨à¤¦à¥€ à¤œà¤²à¤¸à¥à¤¤à¤° à¤”à¤° à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ à¤•à¥€ à¤¸à¤Ÿà¥€à¤• à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤¦à¥‡ à¤¸à¤•à¤¤à¤¾ à¤¹à¥‚à¤‚à¥¤ à¤†à¤ª à¤•à¥à¤¯à¤¾ à¤œà¤¾à¤¨à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?` };
        case 'te':
          return { text: `à°¨à°®à°¸à±à°•à°¾à°°à°‚! à°¨à±‡à°¨à± NEXORA AI à°µà°¿à°ªà°¤à±à°¤à± à°¸à°¹à°¾à°¯à°• à°—à±ˆà°¡à±. à°ªà±à°°à°¸à±à°¤à±à°¤ à°µà°°à°¦ à°®à±à°ªà±à°ªà± à°¸à±à°¥à°¾à°¯à°¿, à°¸à°®à±€à°ª à°ªà±à°¨à°°à°¾à°µà°¾à°¸ à°•à±‡à°‚à°¦à±à°°à°¾à°²à±, à°¨à°¦à°¿ à°¨à±€à°Ÿà°¿ à°®à°Ÿà±à°Ÿà°‚ à°®à°°à°¿à°¯à± à°…à°¤à±à°¯à°µà°¸à°° à°¹à±†à°²à±à°ªà±â€Œà°²à±ˆà°¨à± à°¸à°®à°¾à°šà°¾à°°à°¾à°¨à±à°¨à°¿ à°®à±€à°•à± à°…à°‚à°¦à°¿à°‚à°šà°—à°²à°¨à±. à°®à±€à°•à± à° à°¸à°¹à°¾à°¯à°‚ à°•à°¾à°µà°¾à°²à°¿?` };
        case 'ml':
          return { text: `à´¨à´®à´¸àµà´•à´¾à´°à´‚! à´žà´¾àµ» NEXORA AI à´¦àµà´°à´¨àµà´¤ à´¨à´¿à´µà´¾à´°à´£ à´¸à´¹à´¾à´¯à´¿. à´¤à´¤àµà´¸à´®à´¯ à´ªàµà´°à´³à´¯ à´¸à´¾à´§àµà´¯à´¤, à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³ à´¸àµà´°à´•àµà´·à´¿à´¤ à´•àµà´¯à´¾à´®àµà´ªàµà´•àµ¾, à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ, à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¹àµ†àµ½à´ªàµà´ªàµâ€Œà´²àµˆàµ» à´µà´¿à´µà´°à´™àµà´™àµ¾ à´Žà´¨àµà´¨à´¿à´µ à´žà´¾àµ» à´²à´­àµà´¯à´®à´¾à´•àµà´•à´¾à´‚. à´¨à´¿à´™àµà´™àµ¾à´•àµà´•àµ†à´¨àµà´¤à´¾à´£àµ à´…à´±à´¿à´¯àµ‡à´£àµà´Ÿà´¤àµ?` };
        case 'bn':
          return { text: `à¦¨à¦®à¦¸à§à¦•à¦¾à¦°! à¦†à¦®à¦¿ NEXORA AI à¦¦à§à¦°à§à¦¯à§‹à¦— à¦ªà§à¦°à¦¤à¦¿à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ à¦¸à¦¹à¦•à¦¾à¦°à§€à¥¤ à¦†à¦®à¦¿ à¦†à¦ªà¦¨à¦¾à¦•à§‡ à¦°à¦¿à¦¯à¦¼à§‡à¦²-à¦Ÿà¦¾à¦‡à¦® à¦¬à¦¨à§à¦¯à¦¾ à¦à§à¦à¦•à¦¿, à¦¨à¦¿à¦•à¦Ÿà¦¬à¦°à§à¦¤à§€ à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦°, à¦¨à¦¦à§€à¦° à¦ªà¦¾à¦¨à¦¿à¦° à¦¸à§à¦¤à¦° à¦à¦¬à¦‚ à¦œà¦°à§à¦°à¦¿ à¦¹à§‡à¦²à§à¦ªà¦²à¦¾à¦‡à¦¨à§‡à¦° à¦¸à¦ à¦¿à¦• à¦¤à¦¥à§à¦¯ à¦¦à¦¿à¦¤à§‡ à¦ªà¦¾à¦°à¦¿à¥¤ à¦†à¦ªà¦¨à¦¾à¦° à¦•à§€ à¦¤à¦¥à§à¦¯ à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨?` };
        case 'en':
        default:
          return { text: `Hello! I am NEXORA AI, your emergency disaster response assistant. I can provide verified situational intelligence on flood risk levels, safe shelters, river hydrology, and active emergency operations. How may I help you?` };
      }
    }

    // 6. RISK / THREAT / DANGER
    const isRisk = q1Matches.some(m => q.includes(m.toLowerCase())) ||
                   q.includes('risk') || q.includes('threat') || q.includes('danger') || q.includes('severity') || q.includes('alert') ||
                   q.includes('à®†à®ªà®¤à¯à®¤à¯') || q.includes('à®¨à®¿à®²à¯ˆ') || q.includes('à®¤à¯€à®µà®¿à®°à®®à¯') || q.includes('à®Žà®šà¯à®šà®°à®¿à®•à¯à®•à¯ˆ') ||
                   q.includes('à¤œà¥‹à¤–à¤¿à¤®') || q.includes('à¤–à¤¤à¤°à¤¾') || q.includes('à¤—à¤‚à¤­à¥€à¤°') || q.includes('à¤šà¥‡à¤¤à¤¾à¤µà¤¨à¥€') ||
                   q.includes('à°®à±à°ªà±à°ªà±') || q.includes('à°ªà±à°°à°®à°¾à°¦à°‚') || q.includes('à°¤à±€à°µà±à°°à°¤') || q.includes('à°¹à±†à°šà±à°šà°°à°¿à°•') ||
                   q.includes('à´…à´ªà´•à´Ÿà´‚') || q.includes('à´¸à´¾à´§àµà´¯à´¤') || q.includes('à´¤àµ€à´µàµà´°à´¤') || q.includes('à´®àµà´¨àµà´¨à´±à´¿à´¯à´¿à´ªàµà´ªàµ') ||
                   q.includes('à¦à§à¦à¦•à¦¿') || q.includes('à¦¬à¦¿à¦ªà¦¦') || q.includes('à¦¸à¦¤à¦°à§à¦•à¦¬à¦¾à¦°à§à¦¤à¦¾');

    if (isRisk) {
      switch (lang) {
        case 'ta':
          return { text: `à®¤à®±à¯à®ªà¯‹à®¤à¯ˆà®¯ à®’à®Ÿà¯à®Ÿà¯à®®à¯Šà®¤à¯à®¤ à®ªà¯‡à®°à®¿à®Ÿà®°à¯ à®†à®ªà®¤à¯à®¤à¯ à®¨à®¿à®²à¯ˆ: ${overallRiskLevel} (à®®à®¿à®•à®¤à¯ à®¤à¯€à®µà®¿à®°à®®à¯). à®ªà®¿à®°à®®à¯à®®à®ªà¯à®¤à¯à®¤à®¿à®°à®¾ à®¨à®¤à®¿ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ 82 à®šà¯†.à®®à¯€ (à®†à®ªà®¤à¯à®¤à¯à®•à¯ à®•à¯à®±à®¿à®¯à¯€à®Ÿà¯: ${dangerMarkMeters} à®®à¯€). à®®à®´à¯ˆà®ªà¯à®ªà¯Šà®´à®¿à®µà¯ ${rainfallMmPerHour} à®®à®¿.à®®à¯€/à®®à®£à®¿, à®•à®¾à®±à¯à®±à®¿à®©à¯ à®µà¯‡à®•à®®à¯ ${windSpeedKmh} à®•à®¿.à®®à¯€/à®®à®£à®¿. à®¤à®¾à®´à¯à®µà®¾à®© à®®à®£à¯à®Ÿà®²à®™à¯à®•à®³à¯ à®‰à®¯à®°à¯ à®Žà®šà¯à®šà®°à®¿à®•à¯à®•à¯ˆà®¯à®¿à®²à¯ à®µà¯ˆà®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿà¯à®³à¯à®³à®©.` };
        case 'hi':
          return { text: `à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤¸à¤®à¤—à¥à¤° à¤¬à¤¾à¤¢à¤¼ à¤œà¥‹à¤–à¤¿à¤® à¤¸à¥à¤¤à¤°: ${overallRiskLevel} (à¤—à¤‚à¤­à¥€à¤°) à¤¹à¥ˆà¥¤ à¤¬à¥à¤°à¤¹à¥à¤®à¤ªà¥à¤¤à¥à¤° à¤¨à¤¦à¥€ à¤•à¤¾ à¤œà¤²à¤¸à¥à¤¤à¤° 82 à¤¸à¥‡à¤®à¥€ (à¤–à¤¤à¤°à¥‡ à¤•à¤¾ à¤¨à¤¿à¤¶à¤¾à¤¨: ${dangerMarkMeters} à¤®à¥€à¤Ÿà¤°) à¤ªà¤° à¤¹à¥ˆà¥¤ à¤µà¤°à¥à¤·à¤¾ à¤¦à¤° ${rainfallMmPerHour} à¤®à¤¿à¤®à¥€/à¤˜à¤‚à¤Ÿà¤¾ à¤”à¤° à¤¹à¤µà¤¾ à¤•à¥€ à¤—à¤¤à¤¿ ${windSpeedKmh} à¤•à¤¿à¤®à¥€/à¤˜à¤‚à¤Ÿà¤¾ à¤¹à¥ˆà¥¤ à¤¨à¤¿à¤šà¤²à¥‡ à¤•à¥à¤·à¥‡à¤¤à¥à¤°à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤šà¥‡à¤¤à¤¾à¤µà¤¨à¥€ à¤œà¤¾à¤°à¥€ à¤¹à¥ˆà¥¤` };
        case 'te':
          return { text: `à°ªà±à°°à°¸à±à°¤à±à°¤ à°µà°°à°¦ à°®à±à°ªà±à°ªà± à°¸à±à°¥à°¾à°¯à°¿: ${overallRiskLevel} (à°¤à±€à°µà±à°°à°®à±ˆà°¨à°¦à°¿). à°¬à±à°°à°¹à±à°®à°ªà±à°¤à±à°° à°¨à°¦à°¿ à°¨à±€à°Ÿà°¿ à°®à°Ÿà±à°Ÿà°‚ 82 à°¸à±†à°‚.à°®à±€ (à°ªà±à°°à°®à°¾à°¦ à°¸à±à°¥à°¾à°¯à°¿: ${dangerMarkMeters} à°®à±€). à°µà°°à±à°·à°ªà°¾à°¤à°‚ à°—à°‚à°Ÿà°•à± ${rainfallMmPerHour} à°®à°¿.à°®à±€ à°®à°°à°¿à°¯à± à°—à°¾à°²à°¿ à°µà±‡à°—à°‚ à°—à°‚à°Ÿà°•à± ${windSpeedKmh} à°•à°¿.à°®à±€.` };
        case 'ml':
          return { text: `à´¨à´¿à´²à´µà´¿à´²àµ† à´ªàµà´°à´³à´¯ à´¸à´¾à´§àµà´¯à´¤: ${overallRiskLevel} (à´…à´¤à´¿à´—àµà´°àµà´¤à´°à´‚). à´¬àµà´°à´¹àµà´®à´ªàµà´¤àµà´° à´¨à´¦à´¿à´¯à´¿à´²àµ† à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ 82 à´¸àµ†.à´®àµ€à´±àµà´±à´±à´¿à´²à´¾à´£àµ (à´…à´ªà´•à´Ÿ à´¨à´¿à´²: ${dangerMarkMeters} à´®àµ€à´±àµà´±àµ¼). à´®à´´à´¯àµà´Ÿàµ† à´…à´³à´µàµ à´®à´£à´¿à´•àµà´•àµ‚à´±à´¿àµ½ ${rainfallMmPerHour} à´®à´¿.à´®àµ€à´±àµà´±à´±àµà´‚ à´•à´¾à´±àµà´±à´¿à´¨àµà´±àµ† à´µàµ‡à´—à´¤ à´®à´£à´¿à´•àµà´•àµ‚à´±à´¿àµ½ ${windSpeedKmh} à´•à´¿.à´®àµ€à´±àµà´±à´±àµà´®à´¾à´£àµ.` };
        case 'bn':
          return { text: `à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¸à¦¾à¦®à¦—à§à¦°à¦¿à¦• à¦¬à¦¨à§à¦¯à¦¾ à¦à§à¦à¦•à¦¿à¦° à¦®à¦¾à¦¤à§à¦°à¦¾: ${overallRiskLevel} (à¦šà¦°à¦® à¦à§à¦à¦•à¦¿à¦ªà§‚à¦°à§à¦£)à¥¤ à¦¬à§à¦°à¦¹à§à¦®à¦ªà§à¦¤à§à¦° à¦¨à¦¦à§€à¦° à¦ªà¦¾à¦¨à¦¿à¦° à¦‰à¦šà§à¦šà¦¤à¦¾ à§®à§¨ à¦¸à§‡à¦®à¦¿ (à¦¬à¦¿à¦ªà¦œà§à¦œà¦¨à¦• à¦¸à§à¦¤à¦°: ${dangerMarkMeters} à¦®à¦¿à¦Ÿà¦¾à¦°)à¥¤ à¦¬à§ƒà¦·à§à¦Ÿà¦¿à¦ªà¦¾à¦¤à§‡à¦° à¦ªà¦°à¦¿à¦®à¦¾à¦£ ${rainfallMmPerHour} à¦®à¦¿à¦®à¦¿/à¦˜à¦¨à§à¦Ÿà¦¾ à¦à¦¬à¦‚ à¦¬à¦¾à¦¤à¦¾à¦¸à§‡à¦° à¦—à¦¤à¦¿à¦¬à§‡à¦— ${windSpeedKmh} à¦•à¦¿à¦®à¦¿/à¦˜à¦¨à§à¦Ÿà¦¾à¥¤` };
        case 'en':
        default:
          return { text: `Current overall flood threat level is ${overallRiskLevel}. River stage is at 82 cm (critical crest mark: 95 cm, MSL: ${riverLevelMeters}m vs Danger Mark: ${dangerMarkMeters}m). Rainfall rate is ${rainfallMmPerHour} mm/h with wind velocity at ${windSpeedKmh} km/h.` };
      }
    }

    // 7. SHELTER CAPACITY & AVAILABLE BEDS
    const isCapacity = q4Matches.some(m => q.includes(m.toLowerCase())) ||
                       ((q.includes('shelter') || q.includes('camp')) && (q.includes('capacity') || q.includes('free') || q.includes('bed') || q.includes('available') || q.includes('occupan') || q.includes('space'))) ||
                       q.includes('à®ªà®Ÿà¯à®•à¯à®•à¯ˆ') || q.includes('à®•à¯Šà®³à¯à®³à®³à®µà¯') || q.includes('à®•à®¾à®²à®¿') ||
                       q.includes('à¤¬à¤¿à¤¸à¥à¤¤à¤°') || q.includes('à¤•à¥à¤·à¤®à¤¤à¤¾') || q.includes('à¤–à¤¾à¤²à¥€') ||
                       q.includes('à°¬à±†à°¡à±') || q.includes('à°¸à°¾à°®à°°à±à°¥à±à°¯à°‚') || q.includes('à°–à°¾à°³à±€') ||
                       q.includes('à´¸àµà´¥à´²à´¸àµ—à´•à´°àµà´¯à´‚') || q.includes('à´²à´­àµà´¯à´¤') || q.includes('à´’à´´à´¿à´µàµà´³àµà´³') ||
                       q.includes('à¦¬à¦¿à¦›à¦¾à¦¨à¦¾') || q.includes('à¦§à¦¾à¦°à¦£à¦•à§à¦·à¦®à¦¤à¦¾') || q.includes('à¦–à¦¾à¦²à¦¿ à¦œà¦¾à¦¯à¦¼à¦—à¦¾') || q.includes('à¦œà¦¾à§Ÿà¦—à¦¾');

    if (isCapacity) {
      switch (lang) {
        case 'ta':
          return { text: `à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯à®•à®³à®¿à®©à¯ à®•à¯Šà®³à¯à®³à®³à®µà¯ à®µà®¿à®µà®°à®®à¯:\nâ€¢ ${shelters.map(s => `${s.name}: ${s.totalCapacity - s.currentOccupancy} à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯ (à®‡à®°à¯à®ªà¯à®ªà¯: ${s.currentOccupancy}/${s.totalCapacity})`).join('\nâ€¢ ')}\nà®®à¯Šà®¤à¯à®¤ à®•à®¾à®²à®¿ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯: ${totalFreeBeds}. à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯ à®®à®±à¯à®±à¯à®®à¯ à®‰à®£à®µà¯à®ªà¯ à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯ à®¤à®¯à®¾à®°à®¾à®• à®‰à®³à¯à®³à®©.` };
        case 'hi':
          return { text: `à¤†à¤¶à¥à¤°à¤¯ à¤•à¥à¤·à¤®à¤¤à¤¾ à¤µà¤¿à¤µà¤°à¤£:\nâ€¢ ${shelters.map(s => `${s.name}: ${s.totalCapacity - s.currentOccupancy} à¤–à¤¾à¤²à¥€ à¤¬à¤¿à¤¸à¥à¤¤à¤° (à¤•à¥à¤²: ${s.currentOccupancy}/${s.totalCapacity})`).join('\nâ€¢ ')}\nà¤œà¤¿à¤²à¥‡ à¤•à¥‡ à¤¸à¤­à¥€ à¤¶à¤¿à¤µà¤¿à¤°à¥‹à¤‚ à¤®à¥‡à¤‚ à¤•à¥à¤² ${totalFreeBeds} à¤–à¤¾à¤²à¥€ à¤¬à¤¿à¤¸à¥à¤¤à¤° à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¤‚à¥¤` };
        case 'te':
          return { text: `à°ªà±à°¨à°°à°¾à°µà°¾à°¸ à°•à±‡à°‚à°¦à±à°°à°¾à°² à°¸à°¾à°®à°°à±à°¥à±à°¯à°‚:\nâ€¢ ${shelters.map(s => `${s.name}: ${s.totalCapacity - s.currentOccupancy} à°–à°¾à°³à±€ à°¬à±†à°¡à±à°²à± (à°®à±Šà°¤à±à°¤à°‚: ${s.currentOccupancy}/${s.totalCapacity})`).join('\nâ€¢ ')}\nà°®à±Šà°¤à±à°¤à°‚ à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°¨à±à°¨ à°¬à±†à°¡à±à°²à±: ${totalFreeBeds}.` };
        case 'ml':
          return { text: `à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´•àµà´¯à´¾à´®àµà´ªàµà´•à´³àµà´Ÿàµ† à´¸àµ—à´•à´°àµà´¯à´™àµà´™àµ¾:\nâ€¢ ${shelters.map(s => `${s.name}: ${s.totalCapacity - s.currentOccupancy} à´’à´´à´¿à´µàµà´³àµà´³ à´¬àµ†à´¡àµà´•àµ¾ (à´†à´•àµ†: ${s.currentOccupancy}/${s.totalCapacity})`).join('\nâ€¢ ')}\nà´†à´•àµ† à´²à´­àµà´¯à´®à´¾à´¯ à´¬àµ†à´¡àµà´•àµ¾: ${totalFreeBeds}.` };
        case 'bn':
          return { text: `à¦¤à§à¦°à¦¾à¦£ à¦¶à¦¿à¦¬à¦¿à¦°à§‡à¦° à¦§à¦¾à¦°à¦£à¦•à§à¦·à¦®à¦¤à¦¾ à¦¬à¦¿à¦¬à¦°à¦£:\nâ€¢ ${shelters.map(s => `${s.name}: ${s.totalCapacity - s.currentOccupancy} à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾ (à¦®à§‹à¦Ÿ: ${s.currentOccupancy}/${s.totalCapacity})`).join('\nâ€¢ ')}\nà¦œà§‡à¦²à¦¾à¦¯à¦¼ à¦®à§‹à¦Ÿ ${totalFreeBeds}à¦Ÿà¦¿ à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤ à¦°à¦¯à¦¼à§‡à¦›à§‡à¥¤` };
        case 'en':
        default:
          return { text: `Shelter capacity breakdown:\n${shelters.map(s => `â€¢ ${s.name}: ${s.totalCapacity - s.currentOccupancy} free beds (${s.currentOccupancy}/${s.totalCapacity} occupied)`).join('\n')}\nTotal free beds across all designated relief camps: ${totalFreeBeds}.` };
      }
    }

    // 8. ACTIVE INCIDENTS & SOS
    const isIncidents = q3Matches.some(m => q.includes(m.toLowerCase())) ||
                        q.includes('incident') || q.includes('active') || q.includes('sos') || q.includes('emergency') || q.includes('rescue') || q.includes('trapped') ||
                        q.includes('à®šà®®à¯à®ªà®µà®®à¯') || q.includes('à®…à®µà®šà®°à®®à¯') || q.includes('à®®à¯€à®Ÿà¯à®ªà¯') || q.includes('à®Žà®¤à¯à®¤à®©à¯ˆ') ||
                        q.includes('à¤˜à¤Ÿà¤¨à¤¾') || q.includes('à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨') || q.includes('à¤¬à¤šà¤¾à¤µ') || q.includes('à¤«à¤‚à¤¸à¥‡') || q.includes('à¤•à¤¿à¤¤à¤¨à¥€') ||
                        q.includes('à°¸à°‚à°˜à°Ÿà°¨') || q.includes('à°°à±†à°¸à±à°•à±à°¯à±‚') || q.includes('à°…à°¤à±à°¯à°µà°¸à°°') || q.includes('à°Žà°¨à±à°¨à°¿') ||
                        q.includes('à´¸à´‚à´­à´µà´‚') || q.includes('à´¸à´‚à´­à´µà´™àµà´™àµ¾') || q.includes('à´°à´•àµà´·à´¾à´ªàµà´°à´µàµ¼à´¤àµà´¤à´¨à´‚') || q.includes('à´…à´Ÿà´¿à´¯à´¨àµà´¤à´°') || q.includes('à´Žà´¤àµà´°') ||
                        q.includes('à¦˜à¦Ÿà¦¨à¦¾') || q.includes('à¦‰à¦¦à§à¦§à¦¾à¦°') || q.includes('à¦œà¦°à§à¦°à¦¿') || q.includes('à¦†à¦Ÿà¦•à¦¾') || q.includes('à¦•à¦¤à¦—à§à¦²à¦¿');

    if (isIncidents) {
      switch (lang) {
        case 'ta':
          return { text: `à®®à®¾à®µà®Ÿà¯à®Ÿà®¤à¯à®¤à®¿à®²à¯ à®¤à®±à¯à®ªà¯‹à®¤à¯ ${activeSOS.length} à®…à®µà®šà®° à®šà®®à¯à®ªà®µà®™à¯à®•à®³à¯ à®ªà®¤à®¿à®µà®¾à®•à®¿à®¯à¯à®³à¯à®³à®©. à®‡à®¤à®¿à®²à¯ ${criticalSOS.length} à®šà®®à¯à®ªà®µà®™à¯à®•à®³à¯ à®…à®¤à®¿à®¤à¯€à®µà®¿à®° à®®à¯à®©à¯à®©à¯à®°à®¿à®®à¯ˆ à®•à¯Šà®£à¯à®Ÿ à®ªà®Ÿà®•à¯ à®®à¯€à®Ÿà¯à®ªà¯à®ªà¯ à®ªà®£à®¿à®•à®³à®¾à®•à¯à®®à¯ (à®®à¯à®•à¯à®•à®¿à®¯ à®ªà®•à¯à®¤à®¿: ${activeSOS[0]?.locationName || 'à®ªà®¾à®£à¯à®Ÿà¯ à®•à®¾à®Ÿà¯'}). NDRF à®®à¯€à®Ÿà¯à®ªà¯à®•à¯ à®•à¯à®´à¯à®•à¯à®•à®³à¯ à®•à®³à®¤à¯à®¤à®¿à®²à¯ à®‰à®³à¯à®³à®©.` };
        case 'hi':
          return { text: `à¤œà¤¿à¤²à¥‡ à¤®à¥‡à¤‚ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ ${activeSOS.length} à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤˜à¤Ÿà¤¨à¤¾à¤à¤‚ à¤¦à¤°à¥à¤œ à¤¹à¥ˆà¤‚, à¤œà¤¿à¤¨à¤®à¥‡à¤‚ ${criticalSOS.length} à¤¨à¤¾à¤µ à¤¬à¤šà¤¾à¤µ à¤•à¥€ à¤†à¤µà¤¶à¥à¤¯à¤•à¤¤à¤¾ à¤µà¤¾à¤²à¥€ à¤—à¤‚à¤­à¥€à¤° à¤˜à¤Ÿà¤¨à¤¾à¤à¤‚ à¤¶à¤¾à¤®à¤¿à¤² à¤¹à¥ˆà¤‚ (à¤¶à¥€à¤°à¥à¤· à¤•à¥à¤·à¥‡à¤¤à¥à¤°: ${activeSOS[0]?.locationName || 'à¤ªà¤¾à¤‚à¤¡à¥ à¤˜à¤¾à¤Ÿ'})à¥¤ à¤à¤¨à¤¡à¥€à¤†à¤°à¤à¤« à¤Ÿà¥€à¤®à¥‡à¤‚ à¤¤à¥ˆà¤¨à¤¾à¤¤ à¤¹à¥ˆà¤‚à¥¤` };
        case 'te':
          return { text: `à°œà°¿à°²à±à°²à°¾à°²à±‹ à°ªà±à°°à°¸à±à°¤à±à°¤à°‚ ${activeSOS.length} à°•à±à°°à°¿à°¯à°¾à°¶à±€à°² à°…à°¤à±à°¯à°µà°¸à°° à°¸à°‚à°˜à°Ÿà°¨à°²à± à°‰à°¨à±à°¨à°¾à°¯à°¿. à°µà±€à°Ÿà°¿à°²à±‹ ${criticalSOS.length} à°…à°¤à±à°¯à°µà°¸à°° à°¬à±‹à°Ÿà± à°°à±†à°¸à±à°•à±à°¯à±‚ à°…à°µà°¸à°°à°®à±ˆà°¨à°µà°¿ (${activeSOS[0]?.locationName || 'à°ªà°¾à°‚à°¡à± à°˜à°¾à°Ÿà±'}). à°°à±†à°¸à±à°•à±à°¯à±‚ à°¬à±ƒà°‚à°¦à°¾à°²à± à°ªà°¨à°¿ à°šà±‡à°¸à±à°¤à±à°¨à±à°¨à°¾à°¯à°¿.` };
        case 'ml':
          return { text: `à´œà´¿à´²àµà´²à´¯à´¿àµ½ à´¨à´¿à´²à´µà´¿àµ½ ${activeSOS.length} à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¸à´‚à´­à´µà´™àµà´™àµ¾ à´±à´¿à´ªàµà´ªàµ‹àµ¼à´Ÿàµà´Ÿàµ à´šàµ†à´¯àµà´¤à´¿à´Ÿàµà´Ÿàµà´£àµà´Ÿàµ. à´‡à´¤à´¿àµ½ ${criticalSOS.length} à´Žà´£àµà´£à´‚ à´…à´¤à´¿à´—àµà´°àµà´¤à´° à´¬àµ‹à´Ÿàµà´Ÿàµ à´°à´•àµà´·à´¾à´ªàµà´°à´µàµ¼à´¤àµà´¤à´¨à´™àµà´™à´³à´¾à´£àµ (${activeSOS[0]?.locationName || 'à´ªà´¾à´£àµà´¡àµ à´˜à´¾à´Ÿàµà´Ÿàµ'}). à´°à´•àµà´·à´¾à´ªàµà´°à´µàµ¼à´¤àµà´¤à´¨à´‚ à´ªàµà´°àµ‹à´—à´®à´¿à´•àµà´•àµà´¨àµà´¨àµ.` };
        case 'bn':
          return { text: `à¦œà§‡à¦²à¦¾à¦¯à¦¼ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨à§‡ ${activeSOS.length}à¦Ÿà¦¿ à¦¸à¦•à§à¦°à¦¿à¦¯à¦¼ à¦œà¦°à§à¦°à¦¿ à¦˜à¦Ÿà¦¨à¦¾ à¦°à§‡à¦•à¦°à§à¦¡ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡, à¦¯à¦¾à¦° à¦®à¦§à§à¦¯à§‡ ${criticalSOS.length}à¦Ÿà¦¿ à¦¬à§‹à¦Ÿ à¦‰à¦¦à§à¦§à¦¾à¦°à§‡à¦° à¦œà¦¨à§à¦¯ à¦šà¦°à¦® à¦œà¦°à§à¦°à¦¿ (${activeSOS[0]?.locationName || 'à¦ªà¦¾à¦¨à§à¦¡à§ à¦˜à¦¾à¦Ÿ'})à¥¤ à¦‰à¦¦à§à¦§à¦¾à¦°à¦•à¦¾à¦°à§€ à¦¦à¦² à¦®à§‹à¦¤à¦¾à¦¯à¦¼à§‡à¦¨ à¦°à¦¯à¦¼à§‡à¦›à§‡à¥¤` };
        case 'en':
        default:
          return { text: `There are currently ${activeSOS.length} active emergency incidents recorded in the district, including ${criticalSOS.length} critical priority cases requiring motorboat evacuation (top incident at: ${activeSOS[0]?.locationName || 'Pandu Ghat'}).` };
      }
    }

    // 9. RIVER WATER LEVEL / HYDROLOGY
    const isWater = q5Matches.some(m => q.includes(m.toLowerCase())) ||
                    q.includes('water') || q.includes('river') || q.includes('hydro') || q.includes('level') || q.includes('depth') || q.includes('cwc') || q.includes('gauge') ||
                    q.includes('à®¨à¯€à®°à¯') || q.includes('à®†à®±à¯') || q.includes('à®®à®´à¯ˆ') || q.includes('à®†à®´à®®à¯') ||
                    q.includes('à¤œà¤²à¤¸à¥à¤¤à¤°') || q.includes('à¤ªà¤¾à¤¨à¥€') || q.includes('à¤¨à¤¦à¥€') || q.includes('à¤œà¤²') || q.includes('à¤—à¤¹à¤°à¤¾à¤ˆ') ||
                    q.includes('à°¨à±€à°Ÿà°¿') || q.includes('à°¨à°¦à°¿') || q.includes('à°µà°°à°¦') || q.includes('à°®à°Ÿà±à°Ÿà°‚') ||
                    q.includes('à´µàµ†à´³àµà´³à´‚') || q.includes('à´¨à´¦à´¿') || q.includes('à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ') ||
                    q.includes('à¦ªà¦¾à¦¨à¦¿') || q.includes('à¦œà¦²') || q.includes('à¦¨à¦¦à§€') || q.includes('à¦‰à¦šà§à¦šà¦¤à¦¾');

    if (isWater) {
      switch (lang) {
        case 'ta':
          return { text: `à®ªà®¾à®£à¯à®Ÿà¯ à®¤à¯†à®±à¯à®•à¯ à®•à®°à¯ˆà®¯à®¿à®²à¯ à®‰à®³à¯à®³ à®ªà®¿à®°à®®à¯à®®à®ªà¯à®¤à¯à®¤à®¿à®°à®¾ à®¨à¯€à®°à¯ à®…à®³à®µà¯€à®Ÿà¯ 82 à®šà¯†.à®®à¯€ à®†à®´à®¤à¯à®¤à®¿à®²à¯ (+12 à®šà¯†.à®®à¯€/à®®à®£à®¿ à®‰à®¯à®°à¯à®µà¯) à®‰à®³à¯à®³à®¤à¯. CWC à®†à®ªà®¤à¯à®¤à¯ à®•à¯à®±à®¿à®¯à¯€à®Ÿà¯ ${dangerMarkMeters} à®®à¯€à®Ÿà¯à®Ÿà®°à¯à®•à¯à®•à¯ à®Žà®¤à®¿à®°à®¾à®• à®¤à®±à¯à®ªà¯‹à®¤à¯ˆà®¯ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ ${riverLevelMeters} à®®à¯€à®Ÿà¯à®Ÿà®°à®¾à®• à®‰à®³à¯à®³à®¤à¯.` };
        case 'hi':
          return { text: `à¤ªà¤¾à¤‚à¤¡à¥ à¤¸à¤¾à¤‰à¤¥ à¤¬à¥ˆà¤‚à¤• à¤ªà¤° à¤¬à¥à¤°à¤¹à¥à¤®à¤ªà¥à¤¤à¥à¤° à¤œà¤² à¤¸à¥à¤¤à¤° 82 à¤¸à¥‡à¤®à¥€ à¤—à¤¹à¤°à¤¾à¤ˆ à¤ªà¤° à¤¹à¥ˆ (+12 à¤¸à¥‡à¤®à¥€/à¤˜à¤‚à¤Ÿà¤¾ à¤µà¥ƒà¤¦à¥à¤§à¤¿)à¥¤ à¤•à¥‡à¤‚à¤¦à¥à¤°à¥€à¤¯ à¤œà¤² à¤†à¤¯à¥‹à¤— à¤•à¥‡ à¤–à¤¤à¤°à¥‡ à¤•à¥‡ à¤¨à¤¿à¤¶à¤¾à¤¨ ${dangerMarkMeters} à¤®à¥€à¤Ÿà¤° à¤•à¥‡ à¤®à¥à¤•à¤¾à¤¬à¤²à¥‡ à¤¸à¥à¤¤à¤° ${riverLevelMeters} à¤®à¥€à¤Ÿà¤° à¤ªà¤° à¤¹à¥ˆà¥¤` };
        case 'te':
          return { text: `à°ªà°¾à°‚à°¡à± à°¸à±Œà°¤à± à°¬à±à°¯à°¾à°‚à°•à± à°µà°¦à±à°¦ à°¬à±à°°à°¹à±à°®à°ªà±à°¤à±à°° à°¨à°¦à°¿ à°—à±‡à°œà± 82 à°¸à±†à°‚.à°®à±€ à°µà°¦à±à°¦ à°‰à°‚à°¦à°¿ (+12 à°¸à±†à°‚.à°®à±€/à°—à°‚à°Ÿ à°ªà±†à°°à±à°—à±à°¦à°²). CWC à°ªà±à°°à°®à°¾à°¦ à°¸à±à°¥à°¾à°¯à°¿ ${dangerMarkMeters} à°®à±€à°Ÿà°°à±à°²à± à°•à°¾à°—à°¾ à°ªà±à°°à°¸à±à°¤à±à°¤ à°¸à±à°¥à°¾à°¯à°¿ ${riverLevelMeters} à°®à±€à°Ÿà°°à±à°²à±.` };
        case 'ml':
          return { text: `à´ªà´¾à´£àµà´¡àµ à´¸àµ—à´¤àµà´¤àµ à´¬à´¾à´™àµà´•à´¿à´²àµ† à´¬àµà´°à´¹àµà´®à´ªàµà´¤àµà´° à´œà´²à´¨à´¿à´°à´ªàµà´ªàµ 82 à´¸àµ†.à´®àµ€à´±àµà´±à´±à´¿à´²à´¾à´£àµ (+12 à´¸àµ†.à´®àµ€/à´®à´£à´¿à´•àµà´•àµ‚àµ¼ à´µàµ¼à´¦àµà´§à´¨). à´¸à´¿à´¡à´¬àµà´²àµà´¯àµà´¸à´¿ à´…à´ªà´•à´Ÿ à´¨à´¿à´°à´•àµà´•à´¾à´¯ ${dangerMarkMeters} à´®àµ€à´±àµà´±à´±à´¿à´¨àµ†à´¤à´¿à´°àµ† à´¨à´¿à´²à´µà´¿à´²àµ† à´¨à´¿à´² ${riverLevelMeters} à´®àµ€à´±àµà´±à´±à´¾à´£àµ.` };
        case 'bn':
          return { text: `à¦ªà¦¾à¦¨à§à¦¡à§ à¦¦à¦•à§à¦·à¦¿à¦£ à¦¤à§€à¦°à§‡ à¦¬à§à¦°à¦¹à§à¦®à¦ªà§à¦¤à§à¦° à¦¨à¦¦à§€à¦° à¦—à§‡à¦œ à§®à§¨ à¦¸à§‡à¦®à¦¿ à¦¸à§à¦¤à¦°à§‡ à¦°à¦¯à¦¼à§‡à¦›à§‡ (+à§§à§¨ à¦¸à§‡à¦®à¦¿/à¦˜à¦¨à§à¦Ÿà¦¾ à¦¬à§ƒà¦¦à§à¦§à¦¿)à¥¤ CWC à¦¬à¦¿à¦ªà¦¦à¦¸à§€à¦®à¦¾ ${dangerMarkMeters} à¦®à¦¿à¦Ÿà¦¾à¦°à§‡à¦° à¦¬à¦¿à¦ªà¦°à§€à¦¤à§‡ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¸à§à¦¤à¦° ${riverLevelMeters} à¦®à¦¿à¦Ÿà¦¾à¦°à¥¤` };
        case 'en':
        default:
          return { text: `The Brahmaputra hydrological gauge at Pandu South Bank is standing at 82 cm depth (+12cm/h rise). Current stage is ${riverLevelMeters}m MSL against the Central Water Commission Danger Mark of ${dangerMarkMeters}m.` };
      }
    }

    // 10. EMERGENCY SAFETY, PRECAUTIONS, EVACUATION & HELPLINES
    const isSafety = q.includes('safet') || q.includes('precaution') || q.includes('helpline') || q.includes('phone') || q.includes('call') || q.includes('number') ||
                     q.includes('à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯') || q.includes('à®‰à®¤à®µà®¿') || q.includes('à®Žà®£à¯') ||
                     q.includes('à¤¸à¥à¤°à¤•à¥à¤·à¤¾') || q.includes('à¤¬à¤šà¤¾à¤µ') || q.includes('à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨') || q.includes('à¤¨à¤‚à¤¬à¤°') ||
                     q.includes('à°°à°•à±à°·à°£') || q.includes('à°¸à°¹à°¾à°¯à°‚') || q.includes('à°¹à±†à°²à±à°ªà±â€Œà°²à±ˆà°¨à±') ||
                     q.includes('à´¸àµà´°à´•àµà´·') || q.includes('à´®àµàµ»à´•à´°àµà´¤àµ½') || q.includes('à´¹àµ†àµ½à´ªàµà´ªàµ') ||
                     q.includes('à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾') || q.includes('à¦¸à¦¤à¦°à§à¦•à¦¤à¦¾') || q.includes('à¦¹à§‡à¦²à§à¦ªà¦²à¦¾à¦‡à¦¨') || q.includes('à¦¸à¦¾à¦¹à¦¾à¦¯à§à¦¯');

    if (isSafety) {
      switch (lang) {
        case 'ta':
          return { text: `à®µà¯†à®³à¯à®³à®ªà¯ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®²à¯à®•à®³à¯:\n1. à®‰à®Ÿà®©à®Ÿà®¿à®¯à®¾à®• à®®à®¿à®©à¯à®šà®¾à®°à®®à¯ à®®à®±à¯à®±à¯à®®à¯ à®Žà®°à®¿à®µà®¾à®¯à¯ à®‡à®£à¯ˆà®ªà¯à®ªà¯à®•à®³à¯ˆ à®…à®£à¯ˆà®•à¯à®•à®µà¯à®®à¯.\n2. à®•à¯à®±à¯ˆà®¨à¯à®¤à®ªà®Ÿà¯à®šà®®à¯ 3 à®¨à®¾à®Ÿà¯à®•à®³à¯à®•à¯à®•à¯à®¤à¯ à®¤à¯‡à®µà¯ˆà®¯à®¾à®© à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯, à®‰à®²à®°à¯à®¨à¯à®¤ à®‰à®£à®µà¯ à®®à®±à¯à®±à¯à®®à¯ à®…à®µà®šà®° à®®à®°à¯à®¨à¯à®¤à¯à®•à®³à¯ˆ à®šà¯‡à®®à®¿à®•à¯à®•à®µà¯à®®à¯.\n3. à®®à¯à®´à®™à¯à®•à®¾à®²à¯ à®…à®³à®µà®¿à®±à¯à®•à¯ à®®à¯‡à®²à¯ à®¨à¯€à®°à¯ à®ªà®¾à®¯à¯à®®à¯ à®šà®¾à®²à¯ˆà®•à®³à®¿à®²à¯ à®¨à®Ÿà®•à¯à®•à®µà¯‹ à®µà®¾à®•à®©à®™à¯à®•à®³à¯ˆ à®‡à®¯à®•à¯à®•à®µà¯‹ à®µà¯‡à®£à¯à®Ÿà®¾à®®à¯.\n4. à®…à®°à®šà¯ à®…à®™à¯à®•à¯€à®•à®°à®¿à®¤à¯à®¤ à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯à®•à®³à¯à®•à¯à®•à¯ à®‰à®Ÿà®©à¯‡ à®šà¯†à®²à¯à®²à®µà¯à®®à¯.\nà®…à®µà®šà®° à®‰à®¤à®µà®¿ à®Žà®£à¯à®•à®³à¯ (24x7):\nâ€¢ à®®à®¾à®µà®Ÿà¯à®Ÿ à®…à®µà®šà®° à®•à®Ÿà¯à®Ÿà¯à®ªà¯à®ªà®¾à®Ÿà¯à®Ÿà¯ à®®à¯ˆà®¯à®®à¯: 1077\nâ€¢ à®®à®¾à®¨à®¿à®² à®ªà¯‡à®°à®¿à®Ÿà®°à¯ à®•à®Ÿà¯à®Ÿà¯à®ªà¯à®ªà®¾à®Ÿà¯à®Ÿà¯ à®®à¯ˆà®¯à®®à¯: 1070\nâ€¢ à®•à®¾à®µà®²à¯ & à®ªà¯Šà®¤à¯ à®…à®µà®šà®°à®®à¯: 112\nâ€¢ à®†à®®à¯à®ªà¯à®²à®©à¯à®¸à¯: 108 | à®¤à¯€à®¯à®£à¯ˆà®ªà¯à®ªà¯: 101` };
        case 'hi':
          return { text: `à¤¬à¤¾à¤¢à¤¼ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶:\n1. à¤¤à¥à¤°à¤‚à¤¤ à¤¬à¤¿à¤œà¤²à¥€ à¤”à¤° à¤—à¥ˆà¤¸ à¤†à¤ªà¥‚à¤°à¥à¤¤à¤¿ à¤¬à¤‚à¤¦ à¤•à¤° à¤¦à¥‡à¤‚à¥¤\n2. à¤•à¤® à¤¸à¥‡ à¤•à¤® 3 à¤¦à¤¿à¤¨à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤ªà¥€à¤¨à¥‡ à¤•à¤¾ à¤ªà¤¾à¤¨à¥€, à¤¸à¥‚à¤–à¤¾ à¤­à¥‹à¤œà¤¨ à¤”à¤° à¤†à¤µà¤¶à¥à¤¯à¤• à¤¦à¤µà¤¾à¤à¤‚ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤–à¥‡à¤‚à¥¤\n3. à¤˜à¥à¤Ÿà¤¨à¥‡ à¤¸à¥‡ à¤…à¤§à¤¿à¤• à¤¬à¤¹à¤¤à¥‡ à¤ªà¤¾à¤¨à¥€ à¤®à¥‡à¤‚ à¤šà¤²à¤¨à¥‡ à¤¯à¤¾ à¤—à¤¾à¤¡à¤¼à¥€ à¤šà¤²à¤¾à¤¨à¥‡ à¤•à¥€ à¤•à¥‹à¤¶à¤¿à¤¶ à¤¨ à¤•à¤°à¥‡à¤‚à¥¤\n4. à¤¨à¤¿à¤•à¤Ÿà¤¤à¤® à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤Šà¤‚à¤šà¥‡ à¤†à¤¶à¥à¤°à¤¯ à¤®à¥‡à¤‚ à¤¶à¤°à¤£ à¤²à¥‡à¤‚à¥¤\nà¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ (24x7):\nâ€¢ à¤œà¤¿à¤²à¤¾ à¤†à¤ªà¤¦à¤¾ à¤¨à¤¿à¤¯à¤‚à¤¤à¥à¤°à¤£ à¤•à¤•à¥à¤·: 1077\nâ€¢ à¤°à¤¾à¤œà¥à¤¯ à¤†à¤ªà¤¦à¤¾ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨: 1070\nâ€¢ à¤ªà¥à¤²à¤¿à¤¸ à¤µ à¤°à¤¾à¤·à¥à¤Ÿà¥à¤°à¥€à¤¯ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²: 112\nâ€¢ à¤à¤®à¥à¤¬à¥à¤²à¥‡à¤‚à¤¸: 108 | à¤¦à¤®à¤•à¤²: 101` };
        case 'te':
          return { text: `à°µà°°à°¦ à°°à°•à±à°·à°£ à°®à°¾à°°à±à°—à°¦à°°à±à°¶à°•à°¾à°²à±:\n1. à°µà±†à°‚à°Ÿà°¨à±‡ à°µà°¿à°¦à±à°¯à±à°¤à± à°®à°°à°¿à°¯à± à°—à±à°¯à°¾à°¸à± à°•à°¨à±†à°•à±à°·à°¨à±à°²à°¨à± à°†à°ªà°¿à°µà±‡à°¯à°‚à°¡à°¿.\n2. à°•à°¨à±€à°¸à°‚ 3 à°°à±‹à°œà±à°²à°•à± à°¤à°¾à°—à±à°¨à±€à°°à±, à°Žà°‚à°¡à± à°†à°¹à°¾à°°à°‚ à°®à°°à°¿à°¯à± à°®à°‚à°¦à±à°²à°¨à± à°­à°¦à±à°°à°ªà°°à±à°šà±à°•à±‹à°‚à°¡à°¿.\n3. à°¨à±€à°°à± à°ªà±à°°à°µà°¹à°¿à°¸à±à°¤à±à°¨à±à°¨ à°°à±‹à°¡à±à°²à°ªà±ˆ à°¨à°¡à°µà°µà°¦à±à°¦à± à°²à±‡à°¦à°¾ à°µà°¾à°¹à°¨à°¾à°²à± à°¨à°¡à°ªà°µà°¦à±à°¦à±.\n4. à°ªà±à°°à°­à±à°¤à±à°µ à°ªà±à°¨à°°à°¾à°µà°¾à°¸ à°•à±‡à°‚à°¦à±à°°à°¾à°²à°•à± à°µà±†à°‚à°Ÿà°¨à±‡ à°šà±‡à°°à±à°•à±‹à°‚à°¡à°¿.\nà°…à°¤à±à°¯à°µà°¸à°° à°¹à±†à°²à±à°ªà±â€Œà°²à±ˆà°¨à± à°¨à°‚à°¬à°°à±à°²à±:\nâ€¢ à°œà°¿à°²à±à°²à°¾ à°µà°¿à°ªà°¤à±à°¤à± à°•à±‡à°‚à°¦à±à°°à°‚: 1077\nâ€¢ à°°à°¾à°·à±à°Ÿà±à°° à°…à°¤à±à°¯à°µà°¸à°° à°•à±‡à°‚à°¦à±à°°à°‚: 1070\nâ€¢ à°ªà±‹à°²à±€à°¸à± / à°…à°¤à±à°¯à°µà°¸à°°à°‚: 112\nâ€¢ à°…à°‚à°¬à±à°²à±†à°¨à±à°¸à±: 108 | à°«à±ˆà°°à±: 101` };
        case 'ml':
          return { text: `à´ªàµà´°à´³à´¯ à´¸àµà´°à´•àµà´·à´¾ à´¨à´¿àµ¼à´¦àµà´¦àµ‡à´¶à´™àµà´™àµ¾:\n1. à´µàµˆà´¦àµà´¯àµà´¤à´¿, à´—àµà´¯à´¾à´¸àµ à´•à´£à´•àµà´·à´¨àµà´•àµ¾ à´‰à´Ÿàµ» à´µà´¿à´šàµà´›àµ‡à´¦à´¿à´•àµà´•àµà´•.\n2. à´•àµà´±à´žàµà´žà´¤àµ 3 à´¦à´¿à´µà´¸à´¤àµà´¤àµ‡à´•àµà´•àµà´³àµà´³ à´•àµà´Ÿà´¿à´µàµ†à´³àµà´³à´µàµà´‚ à´‰à´£à´™àµà´™à´¿à´¯ à´­à´•àµà´·à´£à´µàµà´‚ à´®à´°àµà´¨àµà´¨àµà´•à´³àµà´‚ à´•à´°àµà´¤àµà´•.\n3. à´µàµ†à´³àµà´³à´•àµà´•àµ†à´Ÿàµà´Ÿà´¿à´²àµ‚à´Ÿàµ† à´µà´¾à´¹à´¨à´®àµ‹à´Ÿà´¿à´•àµà´•àµà´•à´¯àµ‹ à´¨à´Ÿà´•àµà´•àµà´•à´¯àµ‹ à´šàµ†à´¯àµà´¯à´°àµà´¤àµ.\n4. à´Žà´¤àµà´°à´¯àµà´‚ à´µàµ‡à´—à´‚ à´…à´Ÿàµà´¤àµà´¤àµà´³àµà´³ à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´•àµà´¯à´¾à´®àµà´ªà´¿à´²àµ‡à´•àµà´•àµ à´®à´¾à´±àµà´•.\nà´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´¹àµ†àµ½à´ªàµà´ªàµâ€Œà´²àµˆàµ» à´¨à´®àµà´ªà´±àµà´•àµ¾:\nâ€¢ à´œà´¿à´²àµà´²à´¾ à´¦àµà´°à´¨àµà´¤ à´¨à´¿à´µà´¾à´°à´£ à´•àµºà´Ÿàµà´°àµ‹àµ¾ à´±àµ‚à´‚: 1077\nâ€¢ à´¸à´‚à´¸àµà´¥à´¾à´¨ à´•àµºà´Ÿàµà´°àµ‹àµ¾ à´±àµ‚à´‚: 1070\nâ€¢ à´ªàµ‹à´²àµ€à´¸àµ / à´Žà´®àµ¼à´œàµ»à´¸à´¿: 112\nâ€¢ à´†à´‚à´¬àµà´²àµ»à´¸àµ: 108 | à´«à´¯àµ¼ à´«àµ‹à´´àµà´¸àµ: 101` };
        case 'bn':
          return { text: `à¦¬à¦¨à§à¦¯à¦¾ à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾ à¦¨à¦¿à¦°à§à¦¦à§‡à¦¶à¦¾à¦¬à¦²à§€:\nà§§. à¦¦à§à¦°à§à¦¤ à¦¬à¦¿à¦¦à§à¦¯à§à§Ž à¦à¦¬à¦‚ à¦—à§à¦¯à¦¾à¦¸à§‡à¦° à¦ªà§à¦°à¦§à¦¾à¦¨ à¦¸à¦‚à¦¯à§‹à¦— à¦¬à¦¨à§à¦§ à¦•à¦°à§à¦¨à¥¤\nà§¨. à¦•à¦®à¦ªà¦•à§à¦·à§‡ à§© à¦¦à¦¿à¦¨à§‡à¦° à¦œà¦¨à§à¦¯ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà¦¾à¦¨à¦¿, à¦¶à§à¦•à¦¨à§‹ à¦–à¦¾à¦¬à¦¾à¦° à¦“ à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼ à¦“à¦·à§à¦§ à¦¸à¦‚à¦—à§à¦°à¦¹à§‡ à¦°à¦¾à¦–à§à¦¨à¥¤\nà§©. à¦ªà§à¦°à¦¬à¦¾à¦¹à¦¿à¦¤ à¦¬à¦¨à§à¦¯à¦¾à¦° à¦ªà¦¾à¦¨à¦¿à¦° à¦®à¦§à§à¦¯ à¦¦à¦¿à¦¯à¦¼à§‡ à¦¹à¦¾à¦à¦Ÿà¦¾ à¦¬à¦¾ à¦—à¦¾à¦¡à¦¼à¦¿ à¦šà¦¾à¦²à¦¾à¦¨à§‹à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à¦¬à§‡à¦¨ à¦¨à¦¾à¥¤\nà§ª. à¦¦à§à¦°à§à¦¤ à¦¨à¦¿à¦•à¦Ÿà¦¬à¦°à§à¦¤à§€ à¦‰à¦à¦šà§ à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦°à§‡ à¦šà¦²à§‡ à¦¯à¦¾à¦¨à¥¤\nà¦œà¦°à§à¦°à¦¿ à¦¹à§‡à¦²à§à¦ªà¦²à¦¾à¦‡à¦¨ à¦¨à¦®à§à¦¬à¦° (à§¨à§ªxà§­):\nâ€¢ à¦œà§‡à¦²à¦¾ à¦¦à§à¦°à§à¦¯à§‹à¦— à¦¨à¦¿à¦¯à¦¼à¦¨à§à¦¤à§à¦°à¦£ à¦•à¦•à§à¦·: à§§à§¦à§­à§­\nâ€¢ à¦°à¦¾à¦œà§à¦¯ à¦œà¦°à§à¦°à¦¿ à¦•à§‡à¦¨à§à¦¦à§à¦°: à§§à§¦à§­à§¦\nâ€¢ à¦ªà§à¦²à¦¿à¦¶ à¦“ à¦¸à¦¾à¦°à§à¦¬à¦¿à¦• à¦œà¦°à§à¦°à¦¿: à§§à§§à§¨\nâ€¢ à¦…à§à¦¯à¦¾à¦®à§à¦¬à§à¦²à§‡à¦¨à§à¦¸: à§§à§¦à§® | à¦«à¦¾à¦¯à¦¼à¦¾à¦° à¦¸à¦¾à¦°à§à¦­à¦¿à¦¸: à§§à§¦à§§` };
        case 'en':
        default:
          return { text: `Emergency Flood Safety Directives:\n1. Immediately turn off main electrical circuits and gas supplies.\n2. Store at least 3 days of potable water, dry rations, and critical medications.\n3. Never walk or drive through moving flood waters.\n4. Evacuate along high-ground ridges to designated relief camps.\n24x7 Emergency Helplines:\nâ€¢ District Disaster Control Room: 1077\nâ€¢ State Emergency Operations Center (SEOC): 1070\nâ€¢ Police / National Emergency: 112\nâ€¢ Ambulance: 108 | Fire Rescue: 101` };
      }
    }

    // 11. FOOD, WATER & RELIEF SUPPLIES
    const isSupplies = q.includes('food') || q.includes('ration') || q.includes('supply') || q.includes('medical kit') ||
                       q.includes('à®‰à®£à®µà¯') || q.includes('à®®à®°à¯à®¨à¯à®¤à¯') ||
                       q.includes('à¤­à¥‹à¤œà¤¨') || q.includes('à¤°à¤¾à¤¶à¤¨') || q.includes('à¤¦à¤µà¤¾') ||
                       q.includes('à°†à°¹à°¾à°°à°‚') || q.includes('à°®à°‚à°¦à±à°²à±') ||
                       q.includes('à´­à´•àµà´·à´£à´‚') || q.includes('à´®à´°àµà´¨àµà´¨àµ') ||
                       q.includes('à¦–à¦¾à¦¬à¦¾à¦°') || q.includes('à¦¤à§à¦°à¦¾à¦£');

    if (isSupplies) {
      const totalWater = shelters.reduce((acc, s) => acc + s.resources.waterLiters, 0);
      const totalFood = shelters.reduce((acc, s) => acc + s.resources.foodPackets, 0);
      const totalMeds = shelters.reduce((acc, s) => acc + s.resources.medicalKits, 0);
      switch (lang) {
        case 'ta':
          return { text: `à®¨à®¿à®µà®¾à®°à®£à®ªà¯ à®ªà¯Šà®°à¯à®Ÿà¯à®•à®³à¯ à®‡à®°à¯à®ªà¯à®ªà¯ à®µà®¿à®µà®°à®®à¯:\nâ€¢ à®®à¯Šà®¤à¯à®¤ à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯: ${totalWater.toLocaleString()} à®²à®¿à®Ÿà¯à®Ÿà®°à¯\nâ€¢ à®‰à®£à®µà¯à®ªà¯ à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯: ${totalFood.toLocaleString()} à®ªà¯Šà®Ÿà¯à®Ÿà®²à®™à¯à®•à®³à¯\nâ€¢ à®…à®µà®šà®° à®®à¯à®¤à®²à¯à®¤à®µà®¿ à®ªà¯†à®Ÿà¯à®Ÿà®¿à®•à®³à¯: ${totalMeds} à®ªà¯†à®Ÿà¯à®Ÿà®¿à®•à®³à¯\nà®…à®©à¯ˆà®¤à¯à®¤à¯ à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯à®•à®³à®¿à®²à¯à®®à¯ à®šà¯à®¤à¯à®¤à®¿à®•à®°à®¿à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿ à®•à¯à®Ÿà®¿à®¨à¯€à®°à¯à®®à¯ à®®à®°à¯à®¤à¯à®¤à¯à®µà®•à¯ à®•à¯à®´à¯à®µà¯à®®à¯ à®¤à®¯à®¾à®°à¯ à®¨à®¿à®²à¯ˆà®¯à®¿à®²à¯ à®‰à®³à¯à®³à®©.` };
        case 'hi':
          return { text: `à¤°à¤¾à¤¹à¤¤ à¤¸à¤¾à¤®à¤—à¥à¤°à¥€ à¤¸à¥à¤Ÿà¥‰à¤• à¤µà¤¿à¤µà¤°à¤£:\nâ€¢ à¤•à¥à¤² à¤ªà¥‡à¤¯à¤œà¤²: ${totalWater.toLocaleString()} à¤²à¥€à¤Ÿà¤°\nâ€¢ à¤¤à¥ˆà¤¯à¤¾à¤° à¤­à¥‹à¤œà¤¨ à¤ªà¥ˆà¤•à¥‡à¤Ÿ: ${totalFood.toLocaleString()} à¤ªà¥ˆà¤•à¥‡à¤Ÿ\nâ€¢ à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤•à¤¿à¤Ÿ: ${totalMeds} à¤•à¤¿à¤Ÿ\nà¤¸à¤­à¥€ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤°à¤¾à¤¹à¤¤ à¤¶à¤¿à¤µà¤¿à¤°à¥‹à¤‚ à¤®à¥‡à¤‚ à¤­à¥‹à¤œà¤¨ à¤”à¤° à¤®à¥‡à¤¡à¤¿à¤•à¤² à¤Ÿà¥€à¤® à¤¤à¥ˆà¤¨à¤¾à¤¤ à¤¹à¥ˆà¥¤` };
        case 'te':
          return { text: `à°¸à°¹à°¾à°¯ à°¸à°¾à°®à°¾à°—à±à°°à°¿ à°¨à°¿à°²à±à°µ à°µà°¿à°µà°°à°¾à°²à±:\nâ€¢ à°¤à°¾à°—à±à°¨à±€à°°à±: ${totalWater.toLocaleString()} à°²à±€à°Ÿà°°à±à°²à±\nâ€¢ à°†à°¹à°¾à°° à°ªà±à°¯à°¾à°•à±†à°Ÿà±à°²à±: ${totalFood.toLocaleString()} à°ªà±à°¯à°¾à°•à±†à°Ÿà±à°²à±\nâ€¢ à°®à±†à°¡à°¿à°•à°²à± à°•à°¿à°Ÿà±à°²à±: ${totalMeds}\nà°…à°¨à±à°¨à°¿ à°ªà±à°¨à°°à°¾à°µà°¾à°¸ à°•à±‡à°‚à°¦à±à°°à°¾à°²à°²à±‹ à°¤à°—à°¿à°¨à°‚à°¤ à°¸à°°à°«à°°à°¾ à°‰à°‚à°¦à°¿.` };
        case 'ml':
          return { text: `à´¦àµà´°à´¿à´¤à´¾à´¶àµà´µà´¾à´¸ à´µà´¿à´­à´µà´™àµà´™à´³àµà´Ÿàµ† à´²à´­àµà´¯à´¤:\nâ€¢ à´•àµà´Ÿà´¿à´µàµ†à´³àµà´³à´‚: ${totalWater.toLocaleString()} à´²à´¿à´±àµà´±àµ¼\nâ€¢ à´­à´•àµà´·à´£ à´ªà´¾à´•àµà´•à´±àµà´±àµà´•àµ¾: ${totalFood.toLocaleString()} à´Žà´£àµà´£à´‚\nâ€¢ à´®àµ†à´¡à´¿à´•àµà´•àµ½ à´•à´¿à´±àµà´±àµà´•àµ¾: ${totalMeds} à´Žà´£àµà´£à´‚\nà´Žà´²àµà´²à´¾ à´•àµà´¯à´¾à´®àµà´ªàµà´•à´³à´¿à´²àµà´‚ à´†à´µà´¶àµà´¯à´®à´¾à´¯ à´µà´¿à´­à´µà´™àµà´™àµ¾ à´¸à´œàµà´œàµ€à´•à´°à´¿à´šàµà´šà´¿à´Ÿàµà´Ÿàµà´£àµà´Ÿàµ.` };
        case 'bn':
          return { text: `à¦¤à§à¦°à¦¾à¦£ à¦¸à¦¾à¦®à¦—à§à¦°à§€à¦° à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦®à¦œà§à¦¦:\nâ€¢ à¦®à§‹à¦Ÿ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà¦¾à¦¨à¦¿: ${totalWater.toLocaleString()} à¦²à¦¿à¦Ÿà¦¾à¦°\nâ€¢ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤ à¦–à¦¾à¦¬à¦¾à¦° à¦ªà§à¦¯à¦¾à¦•à§‡à¦Ÿ: ${totalFood.toLocaleString()}à¦Ÿà¦¿\nâ€¢ à¦œà¦°à§à¦°à¦¿ à¦«à¦¾à¦°à§à¦¸à§à¦Ÿ à¦à¦‡à¦¡ à¦•à¦¿à¦Ÿ: ${totalMeds}à¦Ÿà¦¿\nà¦¸à¦•à¦² à¦…à¦¨à§à¦®à§‹à¦¦à¦¿à¦¤ à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦°à§‡ à¦ªà¦°à§à¦¯à¦¾à¦ªà§à¦¤ à¦¤à§à¦°à¦¾à¦£ à¦“ à¦®à§‡à¦¡à¦¿à¦•à§‡à¦² à¦Ÿà¦¿à¦® à¦®à§‹à¦¤à¦¾à¦¯à¦¼à§‡à¦¨ à¦°à¦¯à¦¼à§‡à¦›à§‡à¥¤` };
        case 'en':
        default:
          return { text: `Emergency Relief Supplies Status:\nâ€¢ Potable Water: ${totalWater.toLocaleString()} Liters\nâ€¢ Ready Meal Rations: ${totalFood.toLocaleString()} Packets\nâ€¢ Trauma / First Aid Kits: ${totalMeds} Kits\nAll designated flood shelters maintain minimum 48-hour reserve stocks.` };
      }
    }

    // 12. DEFAULT TELEMETRY SUMMARY
    switch (lang) {
      case 'ta':
        return { text: `à®¨à¯‡à®°à®²à¯ˆ SEOC à®¤à®°à®µà¯: à®®à®¾à®µà®Ÿà¯à®Ÿà®®à¯: ${district}, à®†à®ªà®¤à¯à®¤à¯: ${overallRiskLevel}, à®¤à¯€à®µà®¿à®° à®šà®®à¯à®ªà®µà®™à¯à®•à®³à¯: ${activeSOS.length}, à®•à®¾à®²à®¿ à®®à¯à®•à®¾à®®à¯ à®ªà®Ÿà¯à®•à¯à®•à¯ˆà®•à®³à¯: ${totalFreeBeds}. à®†à®ªà®¤à¯à®¤à¯ à®¨à®¿à®²à¯ˆ, à®¨à®¿à®µà®¾à®°à®£ à®®à¯à®•à®¾à®®à¯à®•à®³à¯, à®†à®±à¯à®±à¯ à®¨à¯€à®°à¯à®®à®Ÿà¯à®Ÿà®®à¯ à®•à¯à®±à®¿à®¤à¯à®¤à¯ à®•à¯‡à®Ÿà¯à®•à®²à®¾à®®à¯.` };
      case 'hi':
        return { text: `à¤²à¤¾à¤‡à¤µ SEOC à¤¡à¥‡à¤Ÿà¤¾: à¤œà¤¿à¤²à¤¾: ${district}, à¤œà¥‹à¤–à¤¿à¤®: ${overallRiskLevel}, à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤˜à¤Ÿà¤¨à¤¾à¤à¤‚: ${activeSOS.length}, à¤–à¤¾à¤²à¥€ à¤¶à¤¿à¤µà¤¿à¤° à¤¬à¤¿à¤¸à¥à¤¤à¤°: ${totalFreeBeds}à¥¤ à¤†à¤ª à¤¬à¤¾à¤¢à¤¼ à¤œà¥‹à¤–à¤¿à¤®, à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤†à¤¶à¥à¤°à¤¯ à¤¯à¤¾ à¤œà¤²à¤¸à¥à¤¤à¤° à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤ªà¥‚à¤› à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤` };
      case 'te':
        return { text: `à°²à±ˆà°µà± SEOC à°¡à±‡à°Ÿà°¾: à°œà°¿à°²à±à°²à°¾: ${district}, à°®à±à°ªà±à°ªà±: ${overallRiskLevel}, à°…à°¤à±à°¯à°µà°¸à°° à°•à°¾à°²à±à°¸à±: ${activeSOS.length}, à°–à°¾à°³à±€ à°¬à±†à°¡à±à°²à±: ${totalFreeBeds}. à°°à°¿à°¸à±à°•à± à°¸à±à°¥à°¾à°¯à°¿, à°†à°¶à±à°°à°¯à°¾à°²à±, à°µà°°à°¦ à°ªà°°à°¿à°¸à±à°¥à°¿à°¤à°¿ à°—à±à°°à°¿à°‚à°šà°¿ à°…à°¡à°—à°‚à°¡à°¿.` };
      case 'ml':
        return { text: `à´¤à´¤àµà´¸à´®à´¯ SEOC à´µà´¿à´µà´°à´™àµà´™àµ¾: à´œà´¿à´²àµà´²: ${district}, à´…à´ªà´•à´Ÿ à´¸à´¾à´§àµà´¯à´¤: ${overallRiskLevel}, à´¸à´œàµ€à´µ à´¸à´‚à´­à´µà´™àµà´™àµ¾: ${activeSOS.length}, à´’à´´à´¿à´µàµà´³àµà´³ à´¬àµ†à´¡àµà´•àµ¾: ${totalFreeBeds}. à´•àµ‚à´Ÿàµà´¤àµ½ à´µà´¿à´µà´°à´™àµà´™àµ¾ à´šàµ‹à´¦à´¿à´•àµà´•à´¾à´µàµà´¨àµà´¨à´¤à´¾à´£àµ.` };
      case 'bn':
        return { text: `à¦²à¦¾à¦‡à¦­ SEOC à¦¤à¦¥à§à¦¯: à¦œà§‡à¦²à¦¾: ${district}, à¦à§à¦à¦•à¦¿à¦° à¦®à¦¾à¦¤à§à¦°à¦¾: ${overallRiskLevel}, à¦¸à¦•à§à¦°à¦¿à¦¯à¦¼ à¦˜à¦Ÿà¦¨à¦¾: ${activeSOS.length}, à¦–à¦¾à¦²à¦¿ à¦¬à¦¿à¦›à¦¾à¦¨à¦¾: ${totalFreeBeds}à¥¤ à¦†à¦ªà¦¨à¦¿ à¦¦à§à¦°à§à¦¯à§‹à¦— à¦à§à¦à¦•à¦¿, à¦†à¦¶à§à¦°à¦¯à¦¼à¦•à§‡à¦¨à§à¦¦à§à¦° à¦¬à¦¾ à¦ªà¦¾à¦¨à¦¿à¦° à¦‰à¦šà§à¦šà¦¤à¦¾ à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡ à¦œà¦¿à¦œà§à¦žà¦¾à¦¸à¦¾ à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¦¨à¥¤` };
      case 'en':
      default:
        return { text: `Based on live SEOC telemetry: District: ${district}, Risk: ${overallRiskLevel}, Active SOS: ${activeSOS.length}, Free Shelter Beds: ${totalFreeBeds}. You can ask about risk levels, shelter locations, incidents, or water depths.` };
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  const handleAsk = async (queryText: string, autoSpeak = false) => {
    const q = queryText.trim();
    if (!q || isStreaming) return;

    const genId = ++genIdRef.current;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setVoiceState('PROCESSING');
    setIsStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    let streamed = '';
    let finalText: string | null = null;
    let locationAction: LocationAction | undefined;

    try {
      // Offline mode: never touch the network, answer straight from the
      // on-device (pretrained) knowledge base.
      if (isForcedOffline) {
        throw new Error('OFFLINE_MODE');
      }

      // Mini-ChatGPT: real LLM with conversation memory + live telemetry context
      const systemPrompt = buildSystemPrompt(currentLanguage, buildLiveSnapshot());
      const history = messagesRef.current
        .filter(m => m.id !== 'm-init')
        .slice(-16)
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text
        }));

      const reply = await streamChatCompletion(
        [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: q }],
        {
          signal: controller.signal,
          onToken: (delta) => {
            streamed += delta;
            setStreamingText(prev => prev + delta);
          }
        }
      );

      if (genId !== genIdRef.current) return; // superseded by clear/new message

      if (reply && reply.trim()) {
        const parsed = extractLocationBlock(reply);
        finalText = parsed.text;
        locationAction = parsed.locationAction;
        setAiStatus('online');
        setAiNotice(null);
      } else {
        throw new Error('EMPTY_LLM_REPLY');
      }
    } catch (err) {
      if (genId !== genIdRef.current) return;

      const stopped = err instanceof DOMException && err.name === 'AbortError';

      if (isForcedOffline) {
        // Deliberate offline mode: the on-device engine is the expected path,
        // not a failure, so keep the status pinned to offline and skip the
        // "service unreachable" notice entirely.
        setAiStatus('offline');
        const result = generateBotResponse(q, currentLanguage);
        finalText = result.text;
        locationAction = result.locationAction;
      } else if (stopped) {
        // User pressed Stop â€” commit whatever was already streamed (if anything)
        finalText = streamed.trim() || null;
        if (!finalText) {
          abortRef.current = null;
          setIsStreaming(false);
          setStreamingText('');
          setVoiceState('IDLE');
          return;
        }
      } else {
        // LLM unreachable -> graceful fallback to the local intelligence engine.
        // Make it visible so it never looks like a canned bot: the next message
        // automatically tries the live AI again.
        setAiStatus('offline');
        const reason = getLastAiError() || '';
        const busy = /429|503|busy|queue|rate/i.test(reason);
        const hint = busy
          ? 'The free AI is just busy right now (too many requests) â€” it auto-retries. Tap Retry AI or ask again in a few seconds.'
          : reason
            ? `Reason: ${reason.replace(/\(.+\)/g, '').trim() || 'unreachable'}.`
            : 'Your next question will automatically retry the live AI.';
        setAiNotice(busy ? hint : `AI service unreachable right now â€” answering from the on-device engine. ${hint}`);
        const result = generateBotResponse(q, currentLanguage);
        finalText = result.text;
        locationAction = result.locationAction;
      }
    }

    abortRef.current = null;
    setIsStreaming(false);
    setStreamingText('');

    const botMsg: ChatMessage = {
      id: `b-${Date.now()}`,
      sender: 'bot',
      text: finalText.trim(),
      locationAction,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, botMsg]);

    // If triggered via voice or autoSpeak, read it aloud in current language
    // Note: speaks ONLY the verbal description without URLs or button labels
    if (autoSpeak) {
      speakText(botMsg.text);
    } else {
      setVoiceState('IDLE');
    }
  };

  const handleAskRef = useRef(handleAsk);
  handleAskRef.current = handleAsk;
  useEffect(() => {
    (window as any).__nexoraChatAsk = (q: string, autoSpeak = false) => handleAskRef.current(q, autoSpeak);
    (window as any).__nexoraGenerateBotResponse = (q: string, lang?: SupportedLanguage) =>
      generateBotResponse(q, lang || currentLanguage);
    return () => {
      delete (window as any).__nexoraChatAsk;
      delete (window as any).__nexoraGenerateBotResponse;
    };
  }, [currentLanguage, generateBotResponse]);

  // Language change synchronizer: safely clean up active recognition and speech
  useEffect(() => {
    voiceRecognitionService.reinitialize(currentLanguage);
    textToSpeechService.stop();
    setVoiceState('IDLE');
    setVoiceNotice(null);
  }, [currentLanguage]);

  // Toggle Speech Recognition with robust lifecycle and error handling
  const toggleVoiceInput = () => {
    if (!voiceRecognitionService.isSupported()) {
      setIsMicSupported(false);
      setVoiceState('UNAVAILABLE');
      setVoiceNotice({
        message: t('voice_status_unsupported', 'Voice input is not supported in this browser. Please type your question.'),
        canRetryVoices: false
      });
      return;
    }

    // Stop speaking if currently speaking
    if (voiceState === 'SPEAKING') {
      textToSpeechService.stop();
      setVoiceState('IDLE');
      return;
    }

    // Stop listening if currently listening
    if (voiceState === 'LISTENING') {
      voiceRecognitionService.stop();
      setVoiceState('IDLE');
      return;
    }

    // Cancel active audio before starting listening
    textToSpeechService.stop();
    setVoiceNotice(null);

    voiceRecognitionService.start(currentLanguage, {
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onTranscript: (transcript, isFinal) => {
        if (transcript.trim() && isFinal) {
          setVoiceState('PROCESSING');
          handleAsk(transcript.trim(), true);
        }
      },
      onError: (err) => {
        setVoiceState('ERROR');
        setVoiceNotice({
          message: err.message,
          canRetryVoices: err.code === 'NETWORK_ERROR' || err.code === 'NO_SPEECH'
        });
      },
      onEnd: () => {
        setVoiceState(prev => (prev === 'LISTENING' ? 'IDLE' : prev));
      }
    });
  };

  const sampleQuestions = [
    t('chat_q1', 'What is the current risk?'),
    t('chat_q2', 'Where is the nearest safe shelter?'),
    t('chat_q3', 'How many active incidents are there?'),
    t('chat_q4', 'Which shelters have available capacity?'),
    t('chat_q5', 'What is the river water level?')
  ];

  return (
    <div className="fixed bottom-5 right-5 z-40 font-body">
      {/* COLLAPSED FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          onClick={openChat}
          className="flex items-center gap-2.5 h-11 pl-3 pr-4 rounded-lg bg-[#1A3A6B] hover:bg-[#142C52] text-white shadow-[0_2px_6px_-1px_rgba(20,21,26,0.16),0_1px_2px_rgba(20,21,26,0.10)] transition-colors duration-150 cursor-pointer group"
          aria-label="Open NEXORA AI Chatbot"
        >
          <div className="w-6 h-6 rounded-md bg-white/15 text-white flex items-center justify-center relative">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white/90 ring-2 ring-[#1A3A6B]" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold font-heading text-white flex items-center gap-1.5">
              <span>{t('chat_header', 'NEXORA AI')}</span>
              <span className="text-[9px] font-normal text-white/60 font-data">
                {currentLanguage.toUpperCase()}
              </span>
            </div>
            <div className="text-[10px] text-white/65 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                aiStatus === 'online' ? 'bg-[#7CC99A]' :
                aiStatus === 'offline' ? 'bg-[#F0A79E]' :
                'bg-[#E8C77A]'
              }`} />
              <span>
                {aiStatus === 'online' ? 'AI Ready â€” ask anything'
                  : isForcedOffline ? 'Offline â€” on-device answers'
                  : aiStatus === 'offline' ? 'AI Offline'
                  : 'Connectingâ€¦'}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* EXPANDED CHAT PANEL */}
      {isOpen && (
        <div className="w-[calc(100vw-32px)] sm:w-[420px] h-[80vh] sm:h-[550px] max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-[#212121] text-[#14151A] dark:text-[#FFFFFF] rounded-xl shadow-[0_24px_48px_-12px_rgba(20,21,26,0.18),0_8px_16px_-8px_rgba(20,21,26,0.08)] border border-[#E4E4E0] dark:border-[#B4B4B4] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* HEADER */}
          <div className="px-4 h-12 bg-[#1A3A6B] text-white flex items-center justify-between border-b border-[#12294D]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-white/15 text-white flex items-center justify-center">
                <Bot className="w-[15px] h-[15px] text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-xs text-white leading-none">
                    {t('chat_header', 'NEXORA AI Assistant')}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-data bg-white/15 text-white/90 border border-white/20">
                    {currentLanguage.toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] text-white/60 font-data mt-1 block flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    aiStatus === 'online' ? 'bg-[#7CC99A]' :
                    aiStatus === 'offline' ? 'bg-[#F0A79E]' :
                    'bg-[#E8C77A]'
                  }`} />
                  <span className="truncate">
                    {district.split(' ')[0]} â€¢{' '}
                    {aiStatus === 'online' ? 'AI Online â€” ask anything'
                      : isForcedOffline ? 'Offline â€” on-device answers'
                      : aiStatus === 'offline' ? 'AI Offline'
                      : 'Connecting to AIâ€¦'}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Stop voice audio button if speaking */}
              {voiceState === 'SPEAKING' && (
                <button
                  onClick={stopSpeaking}
                  className="px-2 py-1 rounded-lg bg-[#B42318] text-white text-[10px] font-bold flex items-center gap-1 hover:bg-[#9A1C13] transition-all cursor-pointer"
                  title={t('voice_stop', 'Stop Voice')}
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{t('voice_stop', 'Stop')}</span>
                </button>
              )}

              {/* Clear conversation button */}
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-[#6B6D77] hover:text-white hover:bg-[#12294D] transition-colors cursor-pointer dark:text-[#D0D0D0]"
                title={t('chat_clear', 'Clear conversation')}
                aria-label={t('chat_clear', 'Clear conversation')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="p-1 rounded-lg text-[#6B6D77] hover:text-white hover:bg-[#12294D] transition-colors cursor-pointer dark:text-[#D0D0D0]"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VOICE STATE INDICATOR BAR (6 CLEAR STATES) */}
          <div data-voice-state={voiceState} className="px-3.5 py-1.5 bg-[#12294D] border-b border-[#1A3A6B] flex items-center justify-between text-[10px] font-data">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                voiceState === 'LISTENING' ? 'bg-[#1A3A6B] animate-ping' :
                voiceState === 'SPEAKING' ? 'bg-[#126B34] animate-pulse' :
                voiceState === 'PROCESSING' ? 'bg-[#E8C77A]' :
                voiceState === 'ERROR' ? 'bg-[#B42318]' :
                voiceState === 'UNAVAILABLE' ? 'bg-[#6B6D77]' :
                'bg-[#126B34]'
              }`} />
              <span className="font-bold text-white uppercase tracking-wider truncate">
                {voiceState === 'LISTENING' ? t('voice_status_listening', 'LISTENING...') :
                 voiceState === 'SPEAKING' ? t('voice_status_speaking', 'SPEAKING...') :
                 voiceState === 'PROCESSING' ? t('voice_status_processing', 'UNDERSTANDING...') :
                 voiceState === 'ERROR' ? t('voice_status_network_error', 'VOICE ERROR') :
                 voiceState === 'UNAVAILABLE' ? t('voice_status_unsupported', 'UNAVAILABLE') :
                 t('voice_status_idle', 'TAP MICROPHONE')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {voiceState === 'LISTENING' && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="px-2 py-0.5 rounded bg-[#B42318] hover:bg-[#9A1C13] text-white text-[9px] font-bold cursor-pointer"
                >
                  Stop
                </button>
              )}
              {voiceState === 'SPEAKING' && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="px-2 py-0.5 rounded bg-[#B42318] hover:bg-[#9A1C13] text-white text-[9px] font-bold cursor-pointer flex items-center gap-1"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
              {voiceState === 'ERROR' && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="px-2 py-0.5 rounded bg-[#A15C07] hover:bg-[#8A4D06] text-white text-[9px] font-bold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>{t('voice_try_again', 'Try Again')}</span>
                </button>
              )}
              <span className="text-[#6B6D77] text-[9px] font-mono dark:text-[#D0D0D0]">
                {LANGUAGE_CONFIG[currentLanguage]?.speechRecognition || SPEECH_LOCALES[currentLanguage] || 'en-IN'}
              </span>
            </div>
          </div>

          {/* VOICE SYSTEM NOTICE / FALLBACK BANNER */}
          {voiceNotice && (
            <div data-voice-notice className="px-3.5 py-2 bg-[#FBF7EC] dark:bg-[#2F2F2F] border-b border-[#F5E0A0] dark:border-[#B4B4B4] text-[11px] text-[#7A3E0B] dark:text-[#FFFFFF] flex items-start justify-between gap-2 animate-fade-in">
              <div className="flex items-start gap-1.5 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-[#A15C07] flex-shrink-0 mt-0.5 dark:text-[#E0E0E0]" />
                <span>{voiceNotice.message}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {voiceNotice.canRetryVoices && (
                  <button
                    type="button"
                    onClick={handleRetryVoices}
                    className="px-2 py-0.5 rounded bg-[#1A3A6B] dark:bg-[#60A5FA] hover:bg-[#12294D] dark:hover:bg-[#1A3A6B] text-white text-[9px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>{t('voice_retry_speech', 'Retry')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVoiceNotice(null)}
                  className="text-[#7A3E0B] dark:text-[#D0D0D0] hover:text-[#6B360C] dark:hover:text-white font-bold text-xs cursor-pointer p-0.5"
                  title="Dismiss"
                >
                  âœ•
                </button>
              </div>
            </div>
          )}

          {/* AI FALLBACK NOTICE (only when the live AI is unreachable) */}
          {aiNotice && (
            <div data-ai-notice className="px-3.5 py-2 bg-[#FBF7EC] dark:bg-[#2F2F2F] border-b border-[#F5E0A0] dark:border-[#B4B4B4] text-[11px] text-[#7A3E0B] dark:text-[#FFFFFF] flex items-start justify-between gap-2 animate-fade-in">
              <div className="flex items-start gap-1.5 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-[#A15C07] flex-shrink-0 mt-0.5 dark:text-[#E0E0E0]" />
                <span>{aiNotice}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isForcedOffline && (
                  <button
                    type="button"
                    onClick={retryAi}
                    className="px-2 py-0.5 rounded bg-[#1A3A6B] dark:bg-[#60A5FA] hover:bg-[#12294D] dark:hover:bg-[#1A3A6B] text-white text-[9px] font-bold cursor-pointer flex items-center gap-1"
                    title="Reconnect to the AI service"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Retry AI</span>
                  </button>
                )}
                {isForcedOffline && (
                  <span className="px-2 py-0.5 rounded bg-[#F0A79E]/25 text-[#7A3E0B] dark:text-[#FFFFFF] text-[9px] font-bold font-data whitespace-nowrap">
                    Network: OFFLINE
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setAiNotice(null)}
                  className="text-[#7A3E0B] dark:text-[#D0D0D0] hover:text-[#6B360C] dark:hover:text-white font-bold text-xs cursor-pointer p-0.5"
                  title="Dismiss"
                  aria-label="Dismiss"
                >
                  âœ•
                </button>
              </div>
            </div>
          )}

          {/* MESSAGES BODY */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-[#F1F1EF] dark:bg-[#171717]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[88%] leading-relaxed whitespace-pre-line shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-[#1A3A6B] dark:bg-[#60A5FA] text-white font-medium border border-[#1A3A6B] dark:border-[#60A5FA]/40'
                      : 'bg-white dark:bg-[#2F2F2F] text-[#14151A] dark:text-[#FFFFFF] border border-[#D5D6DA] dark:border-[#B4B4B4]'
                  }`}
                >
                  <div>{m.text}</div>
                  
                  {/* INTERACTIVE LOCATION ACTION BUTTONS */}
                  {m.sender === 'bot' && m.locationAction && (
                    <div className="mt-2.5 pt-2 border-t border-[#DEDEDA] dark:border-[#B4B4B4] flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleOpenInMap(m.locationAction)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] dark:bg-[#0A2E22] hover:dark:bg-[#3D3D3D] text-white text-[11px] font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-[#1A3A6B] dark:border-[#B4B4B4]"
                        title="Open on Disaster Map"
                        data-action="open-in-maps"
                      >
                        <MapPin className="w-3.5 h-3.5 text-white" />
                        <span>{t('chat_open_maps', 'ðŸ“ Open in Maps')}</span>
                      </button>
                      <button
                        onClick={() => handleGetDirections(m.locationAction)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#142C52] text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="View Safe Evacuation Route"
                        data-action="get-directions"
                      >
                        <Navigation className="w-3.5 h-3.5 text-white" />
                        <span>{t('chat_get_directions', 'ðŸ§­ Get Directions')}</span>
                      </button>
                      {m.locationAction.lat && m.locationAction.lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${m.locationAction.lat},${m.locationAction.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-[#1A3A6B] hover:bg-[#12294D] text-white text-[11px] font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-[#1A3A6B]/30"
                          title="Open in Google Maps"
                          data-action="google-maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-white" />
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 px-1 text-[9px] text-[#6B6D77] dark:text-[#E0E0E0] font-data">
                  <span>{m.timestamp}</span>
                  {m.sender === 'bot' && (
                    <button
                      onClick={() => speakText(m.text)}
                      className="text-[#1A3A6B] dark:text-[#D0D0D0] hover:opacity-80 cursor-pointer"
                      title="Read aloud"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* LIVE STREAMING / TYPING INDICATOR (mini-ChatGPT) */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div className="p-3 rounded-xl max-w-[88%] leading-relaxed whitespace-pre-line shadow-xs bg-white dark:bg-[#2F2F2F] text-[#14151A] dark:text-[#FFFFFF] border border-[#D5D6DA] dark:border-[#B4B4B4]">
                  {streamingText ? (
                    <span>
                      {streamingText}
                      <span className="inline-block w-1.5 h-3.5 bg-[#1A3A6B] rounded-[1px] align-text-bottom ml-0.5 animate-pulse" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A3A6B] nx-typing [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A3A6B] nx-typing [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A3A6B] nx-typing [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* SUGGESTED PROMPTS STRIP */}
          <div className="px-3 py-2 bg-white dark:bg-[#212121] border-t border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {sampleQuestions.slice(0, 3).map((sq, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(sq)}
                className="px-2.5 py-1 rounded-lg bg-[#F1F1EF] dark:bg-[#2F2F2F] hover:bg-[#EEF2F8] hover:dark:bg-[#3D3D3D] text-[#14151A] dark:text-[#FFFFFF] hover:text-[#1A3A6B] dark:hover:text-[#9DB8DC] border border-[#D5D6DA] dark:border-[#B4B4B4] text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* INPUT FOOTER WITH VOICE MICROPHONE BUTTON */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const inputEl = e.currentTarget.querySelector('input[type="text"]') as HTMLInputElement;
              const val = (input.trim() || inputEl?.value || '').trim();
              if (val) {
                handleAsk(val);
              }
            }}
            className="p-2.5 bg-white dark:bg-[#212121] border-t border-[#DEDEDA] dark:border-[#B4B4B4] flex items-center gap-2"
          >
            {/* MICROPHONE BUTTON (Speech-to-Text) */}
            <button
              type="button"
              data-testid="voice-mic-btn"
              onClick={toggleVoiceInput}
              disabled={!isMicSupported}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl border transition-all cursor-pointer flex-shrink-0 flex items-center justify-center ${
                voiceState === 'LISTENING'
                  ? 'bg-[#1A3A6B] text-[#14151A] border-[#1A3A6B] shadow-md animate-pulse ring-2 ring-[#1A3A6B]/50'
                  : voiceState === 'ERROR'
                  ? 'bg-[#FAF0D8] dark:bg-[#2F2F2F] text-[#B42318] border-[#E0776C]'
                  : voiceState === 'SPEAKING'
                  ? 'bg-[#E4F3E9] dark:bg-[#2F2F2F] text-[#126B34] border-[#7CC99A]'
                  : 'bg-[#F1F1EF] dark:bg-[#2F2F2F] text-[#1A3A6B] dark:text-[#D0D0D0] hover:bg-[#EEF2F8] hover:dark:bg-[#3D3D3D] border-[#D5D6DA] dark:border-[#B4B4B4]'
              }`}
              title={
                voiceState === 'LISTENING'
                  ? t('voice_status_listening', 'Listening... Speak now')
                  : voiceState === 'SPEAKING'
                  ? t('voice_status_speaking', 'Speaking... Tap to stop')
                  : `${t('voice_assistant', 'Voice Input')} (${LANGUAGE_CONFIG[currentLanguage]?.speechLocale || 'en-IN'})`
              }
              aria-label={
                voiceState === 'LISTENING'
                  ? t('voice_status_listening', 'Listening... Speak now')
                  : voiceState === 'SPEAKING'
                  ? t('voice_status_speaking', 'Speaking... Tap to stop')
                  : `${t('voice_assistant', 'Voice Input')} (${LANGUAGE_CONFIG[currentLanguage]?.speechLocale || 'en-IN'})`
              }
            >
              {voiceState === 'LISTENING' ? (
                <Mic className="w-5 h-5 text-[#14151A] dark:text-[#FFFFFF]" />
              ) : voiceState === 'ERROR' ? (
                <MicOff className="w-5 h-5 text-[#B42318] dark:text-[#FFFFFF]" />
              ) : voiceState === 'SPEAKING' ? (
                <Volume2 className="w-5 h-5 text-[#126B34] animate-pulse dark:text-[#D0D0D0]" />
              ) : (
                <Mic className="w-5 h-5 text-[#1A3A6B] dark:text-[#D0D0D0]" />
              )}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceState === 'LISTENING'
                  ? t('voice_status_listening', 'Listening to voice... Speak now')
                  : t('chat_placeholder', 'Ask me anythingâ€¦')
              }
              className="flex-1 px-3 py-2 bg-[#F1F1EF] dark:bg-[#171717] border border-[#D5D6DA] dark:border-[#B4B4B4] rounded-xl text-xs text-[#14151A] dark:text-[#FFFFFF] placeholder-[#6B6D77] dark:placeholder-[#E0E0E0] focus:bg-white focus:dark:bg-[#171717] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/40"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={stopGenerating}
                className="p-2 rounded-xl bg-[#B42318] hover:bg-[#9A1C13] text-white shadow-xs transition-colors cursor-pointer flex-shrink-0 border border-[#B42318]"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-[#1A3A6B] dark:bg-[#60A5FA] hover:bg-[#12294D] dark:hover:bg-[#1A3A6B] text-white disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0 border border-[#1A3A6B] dark:border-[#60A5FA]/40"
                title={t('chat_send', 'Send')}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>

        </div>
      )}
    </div>
  );
};
