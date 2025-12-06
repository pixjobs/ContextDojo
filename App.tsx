import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DojoState, MindMapNode, MindMapLink, ChatMessage, ConversationMode } from './types';
import { generateDojoResponse, analyzeInteraction, generateGraphUpdates } from './services/geminiService';
import MindMap from './components/MindMap';
import ChatInterface from './components/ChatInterface';
import VoiceWidget from './components/VoiceWidget';
import EnglishTranscript from './components/EnglishTranscript';

const INITIAL_NODES: MindMapNode[] = [
  { id: 'Context', label: 'Context', group: 1, type: 'root', status: 'active' }
];

const INITIAL_STATE: DojoState = {
  mode: 'adaptive',
  currentTopic: 'Context',
  mindMapNodes: INITIAL_NODES,
  mindMapLinks: [],
  conversationHistory: [
      { 
          role: 'model', 
          text: "Hello! I'm ContextDojo. I'm ready to practice. What's on your mind today?",
          translatedText: "Hello! I'm ContextDojo. I'm ready to practice. What's on your mind today?",
          timestamp: new Date() 
      }
  ],
  lastGuidance: null,
};

function App() {
  const [dojoState, setDojoState] = useState<DojoState>(INITIAL_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('transcript');

  // Streaming States
  const [streamingUser, setStreamingUser] = useState<string>('');
  const [streamingAgent, setStreamingAgent] = useState<string>('');
  
  const streamingUserRef = useRef<string>('');
  const streamingAgentRef = useRef<string>('');

  // --- DOWNLOAD HANDLER ---
  const handleDownload = () => {
      const timestamp = new Date().toISOString().split('T')[0];
      const content = dojoState.conversationHistory.map(msg => {
          return `[${msg.timestamp.toLocaleTimeString()}] ${msg.role.toUpperCase()}:\nOriginal: ${msg.text}\nEnglish: ${msg.translatedText || msg.text}\n`;
      }).join('\n-------------------\n');
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ContextDojo_Session_${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // --- SMART GRAPH UPDATE ---
  const triggerGraphUpdate = async (conversationText: string) => {
      // Only pass Active nodes for context to avoid confusing the AI with potential nodes
      const activeLabels = dojoState.mindMapNodes
          .filter(n => n.status === 'active')
          .map(n => n.label);
      
      const updates = await generateGraphUpdates(conversationText, activeLabels);
      
      if (updates.nodes && updates.nodes.length > 0) {
          setDojoState(prev => {
              const nextNodes = [...prev.mindMapNodes];
              const nextLinks = [...prev.mindMapLinks];
              
              updates.nodes.forEach(n => {
                  const existingNodeIndex = nextNodes.findIndex(ex => ex.label.toLowerCase() === n.label.toLowerCase());

                  if (existingNodeIndex !== -1) {
                      // Node exists
                      const existingNode = nextNodes[existingNodeIndex];
                      
                      // If existing was potential and new is active, upgrade it
                      if (existingNode.status === 'potential' && n.status === 'active') {
                           nextNodes[existingNodeIndex] = { ...existingNode, status: 'active' };
                      }
                      // Do not downgrade active to potential
                  } else {
                      // Create New Node
                      const newNode: MindMapNode = {
                          id: n.label,
                          label: n.label,
                          type: n.type,
                          status: n.status as 'active' | 'potential',
                          group: 2
                      };
                      nextNodes.push(newNode);
                      
                      // Create Link
                      const parentNode = nextNodes.find(ex => ex.label.toLowerCase() === n.parent.toLowerCase()) 
                                         || nextNodes.find(ex => ex.label === 'Context'); 
                      
                      if (parentNode) {
                          // Check if link exists
                          const linkExists = nextLinks.some(l => 
                              (l.source === parentNode.id && l.target === newNode.id) ||
                              (l.source === newNode.id && l.target === parentNode.id)
                          );
                          if (!linkExists) {
                              nextLinks.push({ source: parentNode.id, target: newNode.id });
                          }
                      }
                  }
              });

              return { ...prev, mindMapNodes: nextNodes, mindMapLinks: nextLinks };
          });
      }
  };

  // --- TEXT CHAT HANDLER ---
  const handleSendMessage = useCallback(async (text: string) => {
    if (!dojoState.mode) return;

    const userMsg: ChatMessage = { role: 'user', text, timestamp: new Date() };
    setDojoState(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, userMsg]
    }));
    setIsProcessing(true);

    try {
      const currentHistory = [...dojoState.conversationHistory, userMsg];
      const brainData = await generateDojoResponse(text, currentHistory, dojoState.mode);

      const updatedUserMsg: ChatMessage = { ...userMsg, translatedText: brainData.english_user_translation };
      const newDojoMsg: ChatMessage = { 
        role: 'model', 
        text: brainData.reply_text || "", 
        translatedText: brainData.english_agent_translation,
        timestamp: new Date() 
      };

      setDojoState(prev => {
          const newHistory = [...prev.conversationHistory];
          newHistory[newHistory.length - 1] = updatedUserMsg;
          return {
              ...prev,
              conversationHistory: [...newHistory, newDojoMsg],
              lastGuidance: brainData.coach_guidance || null,
          };
      });

      // Update Graph
      triggerGraphUpdate(`User: ${text}\nAgent: ${brainData.reply_text}`);

    } catch (err) {
      console.error("Error in loop:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [dojoState.conversationHistory, dojoState.mode, dojoState.mindMapNodes]); 

  // --- VOICE HANDLERS ---
  
  const handleVoiceUserTranscript = (text: string) => {
      streamingUserRef.current = text;
      setStreamingUser(text);
  };

  const handleAgentStartedSpeaking = () => {
      const finalText = streamingUserRef.current;
      setStreamingUser('');
      streamingUserRef.current = '';

      if (finalText) {
          const userMsg: ChatMessage = { role: 'user', text: finalText, timestamp: new Date() };
          setDojoState(state => ({
              ...state,
              conversationHistory: [...state.conversationHistory, userMsg]
          }));
      }
  };

  const handleVoiceAgentResponse = (text: string) => {
      streamingAgentRef.current += text;
      setStreamingAgent(prev => prev + text);
  };

  const handleAgentStoppedSpeaking = async () => {
      const finalText = streamingAgentRef.current;
      setStreamingAgent('');
      streamingAgentRef.current = '';

      if (!finalText) return;

      const agentMsg: ChatMessage = { role: 'model', text: finalText, timestamp: new Date() };
      
      // Add Agent Msg to history
      setDojoState(state => ({
          ...state,
          conversationHistory: [...state.conversationHistory, agentMsg]
      }));

      setIsProcessing(true);
      try {
          let lastUserText = "User input";
          const hist = dojoState.conversationHistory;
          for (let i = hist.length - 1; i >= 0; i--) {
              if (hist[i].role === 'user') {
                  lastUserText = hist[i].text;
                  break;
              }
          }

          const brainData = await analyzeInteraction(
              lastUserText, 
              finalText, 
              [...dojoState.conversationHistory, agentMsg], 
              dojoState.mode
          );
          
          setDojoState(prev => {
              const hist = [...prev.conversationHistory];
              
              const userIdx = hist.map(m => m.role).lastIndexOf('user');
              if (userIdx !== -1) {
                  hist[userIdx] = { ...hist[userIdx], translatedText: brainData.english_user_translation };
              }
              
              const agentIdx = hist.map(m => m.role).lastIndexOf('model');
              if (agentIdx !== -1) {
                  hist[agentIdx] = { ...hist[agentIdx], translatedText: brainData.english_agent_translation };
              }
              
              return {
                  ...prev,
                  conversationHistory: hist,
                  lastGuidance: brainData.coach_guidance || null
              };
          });

          // Update Graph
          triggerGraphUpdate(`User: ${lastUserText}\nAgent: ${finalText}`);

      } catch (err) {
          console.error("Analysis Error", err);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleReset = () => {
    setDojoState({
        ...INITIAL_STATE,
        conversationHistory: [] 
    });
    setStreamingUser('');
    setStreamingAgent('');
    streamingUserRef.current = '';
    streamingAgentRef.current = '';
    setOpenSection('transcript');
  };

  const toggleSection = (section: string) => {
      setOpenSection(prev => prev === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow-lg">
             C
           </div>
           <h1 className="text-xl font-bold tracking-tight text-slate-100">
            ContextDojo
           </h1>
        </div>
        
        <div className="flex gap-4 items-center">
            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                Save
            </button>
            <button 
                onClick={handleReset}
                className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
            >
                Clear
            </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-w-7xl mx-auto">
          
          {/* Left Col: Analysis Accordion */}
          <div className="lg:col-span-8 flex flex-col gap-4 h-full min-h-0 bg-slate-900/30 rounded-2xl p-1 border border-slate-800/50">
            
            {/* Accordion Item 1: Context Map */}
            <div className={`flex flex-col transition-all duration-300 ease-in-out rounded-xl border ${openSection === 'map' ? 'flex-[2] border-slate-700 bg-slate-900/50' : 'flex-none border-transparent hover:bg-slate-800/50'}`}>
                <button 
                    onClick={() => toggleSection('map')}
                    className="w-full flex items-center justify-between p-4 focus:outline-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${openSection === 'map' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" />
                           </svg>
                        </div>
                        <span className={`font-semibold text-sm ${openSection === 'map' ? 'text-white' : 'text-slate-400'}`}>Context Galaxy</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${openSection === 'map' ? 'rotate-180' : ''}`}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
                
                {openSection === 'map' && (
                    <div className="flex-1 min-h-0 relative overflow-hidden rounded-b-xl animate-fade-in">
                       <div className="absolute inset-0 bg-grid-slate-800/[0.05] bg-[bottom_1px_center]" style={{ backgroundSize: '24px 24px' }}></div>
                       <MindMap nodes={dojoState.mindMapNodes} links={dojoState.mindMapLinks} />
                    </div>
                )}
            </div>

            {/* Accordion Item 2: English Transcript */}
            <div className={`flex flex-col transition-all duration-300 ease-in-out rounded-xl border ${openSection === 'transcript' ? 'flex-[2] border-slate-700 bg-slate-900/50' : 'flex-none border-transparent hover:bg-slate-800/50'}`}>
               <button 
                    onClick={() => toggleSection('transcript')}
                    className="w-full flex items-center justify-between p-4 focus:outline-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${openSection === 'transcript' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                             <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                           </svg>
                        </div>
                        <span className={`font-semibold text-sm ${openSection === 'transcript' ? 'text-white' : 'text-slate-400'}`}>English Transcript</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${openSection === 'transcript' ? 'rotate-180' : ''}`}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
                
                {openSection === 'transcript' && (
                    <div className="flex-1 min-h-0 rounded-b-xl overflow-hidden animate-fade-in relative">
                       {dojoState.lastGuidance && (
                           <div className="absolute bottom-2 left-2 right-2 z-20">
                               <div className="bg-slate-800/95 border border-indigo-500/50 p-2.5 rounded-lg shadow-xl backdrop-blur-md flex gap-2 items-start">
                                  <div className="p-1 bg-indigo-500/20 rounded-md text-indigo-300 mt-0.5">
                                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                       <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                                     </svg>
                                  </div>
                                  <p className="text-xs text-slate-200 leading-snug">{dojoState.lastGuidance}</p>
                               </div>
                           </div>
                       )}
                       <EnglishTranscript 
                           history={dojoState.conversationHistory} 
                           streamingAgent={streamingAgent}
                       />
                    </div>
                )}
            </div>

          </div>

          {/* Right Col: Chat & Voice */}
          <div className="lg:col-span-4 h-full min-h-0 flex flex-col gap-4">
             <VoiceWidget 
                  onUserTranscript={handleVoiceUserTranscript}
                  onAgentResponse={handleVoiceAgentResponse}
                  onAgentStartedSpeaking={handleAgentStartedSpeaking}
                  onAgentStoppedSpeaking={handleAgentStoppedSpeaking}
             />
             
             <div className="flex-1 overflow-hidden shadow-2xl rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md">
                 <ChatInterface 
                   history={dojoState.conversationHistory} 
                   onSendMessage={handleSendMessage}
                   isLoading={isProcessing}
                   streamingMessage={streamingAgent}
                   streamingUserText={streamingUser}
                 />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;