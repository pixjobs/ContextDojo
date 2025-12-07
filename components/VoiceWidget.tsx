import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation } from '@11labs/client';
import { LabelSet } from '../constants/translations';

// TODO: Paste your Agent ID here for the Hackathon Demo
const DEMO_AGENT_ID = ""; 

interface VoiceWidgetProps {
  onUserTranscript: (text: string) => void;
  onAgentResponse: (text: string) => void;
  onUserTurnComplete: (text: string) => void; // Commits user text to history
  onTurnComplete: () => void; // Commits agent text to history & triggers analysis
  labels: LabelSet;
}

const VoiceWidget: React.FC<VoiceWidgetProps> = ({ 
    onUserTranscript, 
    onAgentResponse, 
    onUserTurnComplete,
    onTurnComplete,
    labels 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('elevenlabs_agent_id');
        if (stored) return stored;
    }
    return DEMO_AGENT_ID;
  });

  const [showConfig, setShowConfig] = useState(!agentId);
  const conversationRef = useRef<any>(null);

  // Data Refs to accumulate speech during a turn
  const userSpeechBuffer = useRef<string>('');
  
  // Callbacks refs
  const onUserTranscriptRef = useRef(onUserTranscript);
  const onAgentResponseRef = useRef(onAgentResponse);
  const onUserTurnCompleteRef = useRef(onUserTurnComplete);
  const onTurnCompleteRef = useRef(onTurnComplete);

  useEffect(() => {
    onUserTranscriptRef.current = onUserTranscript;
    onAgentResponseRef.current = onAgentResponse;
    onUserTurnCompleteRef.current = onUserTurnComplete;
    onTurnCompleteRef.current = onTurnComplete;
  }, [onUserTranscript, onAgentResponse, onUserTurnComplete, onTurnComplete]);

  useEffect(() => {
     if (agentId) {
         localStorage.setItem('elevenlabs_agent_id', agentId);
     }
  }, [agentId]);

  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession();
      }
    };
  }, []);

  const startConversation = useCallback(async () => {
    if (!agentId) {
        setShowConfig(true);
        return;
    }

    try {
      setStatusMsg('Requesting Mic...');
      // Explicitly ask for mic permission first to avoid SDK timeout issues
      await navigator.mediaDevices.getUserMedia({ audio: true });

      setStatusMsg('Connecting...');
      console.log("[ContextDojo] Starting Session with Agent ID:", agentId);
      
      const conversation = await Conversation.startSession({
        agentId: agentId, 
        onConnect: () => {
          console.log("[ContextDojo] Connected to ElevenLabs");
          setIsConnected(true);
          setShowConfig(false);
          setStatusMsg('');
          userSpeechBuffer.current = '';
        },
        onDisconnect: () => {
          console.log("[ContextDojo] Disconnected");
          setIsConnected(false);
          setIsSpeaking(false);
          setStatusMsg('');
        },
        onError: (error: any) => {
          console.error("[ContextDojo] ElevenLabs Error:", error);
          alert("Connection Error. Check Console.");
          setIsConnected(false);
          setStatusMsg('Error');
        },
        onModeChange: (mode: { mode: string }) => {
           // 'speaking' = Agent is speaking
           // 'listening' = Agent is listening (User is speaking)
           console.log("[ContextDojo] Mode Change:", mode);
           const isAgentSpeaking = mode.mode === 'speaking';
           setIsSpeaking(isAgentSpeaking);

           if (isAgentSpeaking) {
               // Agent JUST STARTED speaking. 
               // This means User is DONE. Commit User Buffer.
               if (userSpeechBuffer.current && userSpeechBuffer.current.trim().length > 0) {
                   console.log("[ContextDojo] Committing User Turn:", userSpeechBuffer.current);
                   onUserTurnCompleteRef.current(userSpeechBuffer.current);
                   userSpeechBuffer.current = ''; // Clear buffer
               }
           } else {
               // Agent JUST STOPPED speaking (went to listening mode).
               // This means Agent Turn is DONE.
               // We trigger the analysis hook.
               console.log("[ContextDojo] Agent Finished Speaking - End of Cycle");
               onTurnCompleteRef.current();
           }
        },
        onMessage: (props: any) => {
            // Debug log to see exactly what we get
            // console.log("[ContextDojo] Message:", props);

            const text = props.text || props.message || "";
            const source = props.source;

            if (source === 'user') {
                // Real-time user transcript
                if (text) {
                    userSpeechBuffer.current = text; // Update buffer
                    onUserTranscriptRef.current(text); // Update UI
                }
            } else if (source === 'ai' || source === 'character' || source === 'assistant') {
                // Real-time agent transcript
                // Handle different source names depending on SDK version
                if (text) {
                    onAgentResponseRef.current(text);
                }
            }
        }
      } as any);

      conversationRef.current = conversation;

    } catch (error) {
      console.error("Failed to start conversation:", error);
      setStatusMsg('Connection Failed');
      setIsConnected(false);
    }
  }, [agentId]);

  const endConversation = async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
  };

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col items-center gap-4">
       {!isConnected && (
           <div className="w-full transition-all">
            {showConfig || !agentId ? (
                <div className="flex flex-col gap-3 mb-2 animate-fade-in bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                    <div>
                        <label className="text-xs text-slate-300 font-semibold block mb-1">ElevenLabs Agent ID</label>
                        <input 
                            type="text" 
                            value={agentId} 
                            onChange={(e) => setAgentId(e.target.value)}
                            placeholder="e.g. JjC9C..."
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white w-full focus:border-blue-500 outline-none"
                        />
                    </div>
                    {agentId && (
                         <button onClick={() => setShowConfig(false)} className="text-xs text-blue-400 hover:text-blue-300 underline self-end mt-1">
                            {labels.done}
                         </button>
                    )}
                </div>
            ) : (
                <button onClick={() => setShowConfig(true)} className="flex items-center justify-end gap-1 text-xs text-slate-500 hover:text-slate-300 w-full mb-2">
                    <span>{labels.configAgent}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
           </div>
       )}

      <div className="relative">
        {isConnected && <div className="absolute inset-0 bg-blue-500 rounded-full animate-pulse-ring opacity-75"></div>}
        <button
            onClick={isConnected ? endConversation : startConversation}
            className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
            {isConnected ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
            )}
        </button>
      </div>
      <div className="text-center">
         <h3 className="text-white font-bold text-sm">
             {isConnected ? (isSpeaking ? labels.agentSpeaking : labels.listening) : labels.voiceMode}
         </h3>
         <p className="text-xs text-slate-400">
             {statusMsg || (isConnected ? labels.speakNaturally : labels.tapToConnect)}
         </p>
      </div>
    </div>
  );
};

export default VoiceWidget;