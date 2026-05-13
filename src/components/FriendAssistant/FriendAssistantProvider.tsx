import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import CollapsedAvatar from './CollapsedAvatar';
import ExpandedChat from './ExpandedChat';
import SovereignVisualizer from './SovereignVisualizer'; 
import { FriendState, Message } from './types';
import { getContextualGreeting } from './orbUtils';
import { useSyllableBlinking } from './useSyllableBlinking';
import { X, Keyboard, Mic, MicOff } from 'lucide-react'; 
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";

type Trigger = 'social' | 'wallet' | 'data' | 'achievement' | undefined;

interface FriendAssistantContextValue {
  open: (trigger?: Trigger) => void;
  startLiveMode: () => void;
  switchToText: () => void;
  close: () => void;
  isVisible: boolean;
  isLiveMode: boolean;
  isTextMode: boolean;
  friendState: FriendState;
  isSyllableBlinking: boolean;
  isListening: boolean;
}

const FriendAssistantContext = createContext<FriendAssistantContextValue | null>(null);

export const useFriendAssistant = () => {
  const ctx = useContext(FriendAssistantContext);
  if (!ctx) throw new Error('useFriendAssistant must be used within FriendAssistantProvider');
  return ctx;
};

export const FriendAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useProfile();
  
  const [isVisible, setIsVisible] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  
  const [trigger, setTrigger] = useState<Trigger>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [friendState, setFriendState] = useState<FriendState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  // Hardware Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const globalAudioCtxRef = useRef<AudioContext | any>(null);

  // VAD (Voice Activity Detection) Refs
  const vadFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number>(0);

  const rawCustomName = (profile as any)?.ai_assistant_name;
  const assistantName = rawCustomName || "Friend";
  const { } = useSyllableBlinking();
  const isSyllableBlinking = friendState === 'speaking';

  useEffect(() => {
    if (!profile) return;

    if (messages.length === 0) {
      console.log(`=== [INITIAL_GREETING_START] Identity Resolved: ${assistantName} ===`);
      const greetingText = getContextualGreeting(trigger, assistantName);
      setMessages([{
        id: 'initial_contact_id',
        text: greetingText,
        isUser: false,
        timestamp: new Date(),
      }]);
    }
  }, [trigger, messages.length, profile, assistantName]);

  // --- 1. SPEAK TEXT (Web Audio API Loudspeaker Routing) ---
  const speakText = useCallback(async (text: string) => {
    console.log("=== [VOICE_OUT_START] Synthesizing: ", text.substring(0, 30), "... ===");
    try {
      setFriendState('speaking');
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: '9BWtsMINqrJLrRacOk9x' },
      });
      if (error) throw error;
      
      if (data?.audioContent) {
        const audioCtx = globalAudioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const binaryString = window.atob(data.audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        source.onended = () => {
          console.log("=== [VOICE_OUT_END] Playback completed ===");
          if (isVoiceMode) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            setTimeout(() => startVoiceListening(), 400);
          } else {
            setFriendState('idle');
          }
        };

        source.start(0);
      } else {
        setFriendState('idle');
      }
    } catch (e) {
      console.error('=== [VOICE_OUT_CRITICAL] TTS Engine Stalled:', e);
      setFriendState('idle');
    }
  }, [isVoiceMode]);

  // --- 2. GENERATE AI RESPONSE (With Existential Override) ---
  const generateAIResponse = useCallback(async (userText: string) => {
    console.log("=== [AI_CHAT_START] Dispatching to Edge Function ===");
    try {
      setFriendState('thinking');

      // Intercept the text on the frontend to break LLM character blocks
      const payloadMessage = isVoiceMode 
        ? `[SYSTEM OVERRIDE: You are engaged in a Live Voice conversation. You are speaking out loud via an ElevenLabs voice synthesizer. Keep your response highly conversational, concise, and natural. DO NOT use emojis or formatting. NEVER claim to be a text-based AI.]\n\nUser says: ${userText}`
        : userText;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          message: payloadMessage, 
          mode: isVoiceMode ? 'voice' : 'text',
          trigger_context: trigger,
          user_id: profile?.id 
        }
      });

      if (error) throw error;

      const responseText = data?.response || "I'm processing a high-load request. Give me one moment.";
      
      const aiResponse: Message = {
        id: Date.now().toString() + '_ai',
        text: responseText,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
      await speakText(responseText);
    } catch (e) {
      console.error('=== [AI_CHAT_CRITICAL] Brain Egress Stalled:', e);
      setFriendState('idle');
    }
  }, [isVoiceMode, messages.length, trigger, speakText, profile?.id]);

  // --- 3. PROCESS VOICE INPUT ---
  const processVoiceInput = useCallback(async (base64Audio: string) => {
    console.log("=== [VOICE_IN_START] Processing transcription ===");
    try {
      setFriendState('thinking');
      setIsListening(false);
      
      const { data, error } = await supabase.functions.invoke('voice-to-text', { 
        body: { audio: base64Audio } 
      });
      
      if (error) throw error;
      
      if (data?.text?.trim()) {
        console.log("=== [VOICE_IN_SUCCESS] Decoded: ", data.text);
        setMessages(prev => [...prev, { id: Date.now().toString(), text: data.text, isUser: true, timestamp: new Date() }]);
        await generateAIResponse(data.text);
      } else if (isVoiceMode) {
        console.warn("=== [VOICE_IN_EMPTY] Silent stream detected, cycling ===");
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        setTimeout(() => startVoiceListening(), 400);
      } else {
        setFriendState('idle');
      }
    } catch (e) {
      console.error('=== [VOICE_IN_CRITICAL] STT Failed:', e);
      setFriendState('idle');
    }
  }, [isVoiceMode, generateAIResponse]);

  // --- 4. START VOICE LISTENING (With VAD Silence Detection) ---
  const startVoiceListening = async () => {
    console.log("=== [LISTENER_START] Activating local hardware mic ===");
    try {
      let stream = activeStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreamRef.current = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("=== [LISTENER_STOP] MediaRecorder halted. Compiling buffer ===");
        if (vadFrameRef.current) {
          cancelAnimationFrame(vadFrameRef.current);
          vadFrameRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          if (base64data) {
             processVoiceInput(base64data);
          }
        };
      };

      mediaRecorder.start();
      setIsListening(true);
      setFriendState('listening');

      // VAD ENGINE
      console.log("=== [VAD_INIT] Booting Silence Detector ===");
      const audioCtx = globalAudioCtxRef.current;
      
      if (audioCtx && audioCtx.state === 'running') {
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.minDecibels = -80;
        analyser.maxDecibels = -10;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const SILENCE_THRESHOLD = 5; 
        const MAX_SILENCE_MS = 1500; 
        silenceTimerRef.current = Date.now();

        const monitorAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const averageVolume = sum / bufferLength;

          if (averageVolume > SILENCE_THRESHOLD) {
            silenceTimerRef.current = Date.now();
          } else {
            const silenceDuration = Date.now() - silenceTimerRef.current;
            if (silenceDuration > MAX_SILENCE_MS) {
              console.log(`=== [VAD_TRIGGER] ${MAX_SILENCE_MS}ms of silence detected. Auto-cutting mic. ===`);
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
              }
              return; 
            }
          }
          vadFrameRef.current = requestAnimationFrame(monitorAudio);
        };

        monitorAudio();
      }
    } catch (e) {
      console.error("=== [LISTENER_CRITICAL] Hardware access denied or stalled ===", e);
      setIsListening(false);
      setIsVoiceMode(false);
      setFriendState('idle');
    }
  };

  const stopVoiceListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    setIsListening(false);
    setFriendState('idle');
  };

  const fullyShutdownMic = () => {
    stopVoiceListening();
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
  };

  const initHardwareSync = () => {
    if (!globalAudioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        globalAudioCtxRef.current = new AudioCtx();
      }
    }
    if (globalAudioCtxRef.current && globalAudioCtxRef.current.state === 'suspended') {
      globalAudioCtxRef.current.resume();
    }
  };

  const startLiveMode = () => {
    setIsTextMode(false);
    setIsLiveMode(true);
    setIsVisible(true);

    initHardwareSync();

    const bootSequence = async () => {
      try {
        setIsVoiceMode(true);
        await startVoiceListening();
      } catch (err) {
        console.error("=== [MIC_CRITICAL_FAIL] iOS rejected the stream:", err);
        setIsVoiceMode(false);
        setIsListening(false);
      }
    };

    bootSequence();
  };

  const handleVoiceToggle = () => {
    initHardwareSync();

    if (isVoiceMode) {
      setIsVoiceMode(false);
      fullyShutdownMic();
    } else {
      setIsVoiceMode(true);
      startVoiceListening();
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), text: inputValue, isUser: true, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    await generateAIResponse(userMessage.text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  const value: FriendAssistantContextValue = {
    open: (t) => { setTrigger(t); setIsVisible(true); },
    startLiveMode,
    switchToText: () => {
      setIsLiveMode(false);
      setIsTextMode(true);
      setIsVoiceMode(false);
      fullyShutdownMic();
    },
    close: () => {
      setIsLiveMode(false);
      setIsTextMode(false);
      setIsVoiceMode(false);
      fullyShutdownMic();
      setFriendState('idle');
    },
    isVisible,
    isLiveMode,
    isTextMode,
    friendState,
    isSyllableBlinking,
    isListening,
  };

  useEffect(() => {
    const handler = (e: any) => {
      setTrigger(e.detail?.trigger);
      setIsVisible(true);
    };
    window.addEventListener('showFriend', handler);
    return () => window.removeEventListener('showFriend', handler);
  }, []);

  return (
    <FriendAssistantContext.Provider value={value}>
      {children}
      
      {isVisible && isLiveMode && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col items-center justify-center animate-in fade-in duration-500 overflow-hidden">
          
          {rawCustomName && (
            <div 
              className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none transition-transform duration-75"
              style={{ transform: 'translate(calc(var(--roll) * -30px), calc(var(--pitch) * 30px))' }}
            >
              <h1 className="text-[15vw] font-thin uppercase tracking-[0.3em] text-slate-400/10 dark:text-white/5 blur-[2px]">
                {rawCustomName}
              </h1>
            </div>
          )}

          <div className="absolute inset-0 z-10 pointer-events-none">
            <SovereignVisualizer 
              state={friendState} 
              severity={trigger === 'achievement' ? 'important' : 'normal'} 
            />
          </div>

          <div className="absolute top-16 w-full px-8 flex justify-between items-center z-50">
            <Badge variant="outline" className="border-black/10 dark:border-white/10 text-slate-800 dark:text-white/40 uppercase tracking-[0.4em] bg-white/20 dark:bg-black/20 backdrop-blur-md px-4 py-1 shadow-sm">
              {assistantName} Live
            </Badge>
            <button onClick={value.close} className="p-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shadow-sm">
              <X className="w-5 h-5 text-slate-800 dark:text-white/50" />
            </button>
          </div>

          <div className="absolute bottom-40 text-center z-50 pointer-events-none">
            <p className="text-slate-600 dark:text-white/20 font-black uppercase tracking-[0.6em] text-[10px] animate-pulse">
              {friendState === 'listening' ? 'Ingesting Stream' : 
               friendState === 'thinking' ? 'Deep Analysis' : 
               friendState === 'speaking' ? `Projecting ${assistantName}` : ''}
            </p>
          </div>

          <div className="absolute bottom-12 w-full flex justify-center gap-8 z-50">
            <button 
              onClick={handleVoiceToggle}
              className={`p-6 rounded-full backdrop-blur-xl transition-all duration-500 shadow-md ${isListening ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30 dark:border-blue-500/50 shadow-[0_0_30px_rgba(37,99,235,0.15)]' : 'bg-black/5 text-slate-800 dark:bg-white/5 dark:text-white border border-black/10 dark:border-white/10'}`}
            >
              {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
            </button>
            <button 
              onClick={value.switchToText}
              className="p-6 rounded-full bg-black/5 text-slate-500 dark:bg-white/5 dark:text-white/30 border border-black/5 dark:border-white/5 backdrop-blur-xl hover:text-slate-800 dark:hover:text-white transition-colors shadow-sm"
            >
              <Keyboard className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {isVisible && isTextMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <ExpandedChat
            messages={messages}
            inputValue={inputValue}
            friendState={friendState}
            isListening={isListening}
            isSyllableBlinking={isSyllableBlinking}
            isVoiceMode={isVoiceMode}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onKeyPress={handleKeyPress}
            onVoiceToggle={handleVoiceToggle}
            onCollapse={() => setIsTextMode(false)}
            onClose={value.close}
            onSpeakText={speakText}
          />
        </div>
      )}
    </FriendAssistantContext.Provider>
  );
};

export const FriendOrb: React.FC = () => {
  const { isVisible, friendState, isSyllableBlinking, isListening, startLiveMode } = useFriendAssistant();
  
  if (!isVisible) return null;
  
  return (
    <CollapsedAvatar
      friendState={friendState}
      isListening={isListening}
      isSyllableBlinking={isSyllableBlinking}
      onOrbClick={startLiveMode} 
    />
  );
};