import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { LabelSet } from '../constants/translations';

interface EnglishTranscriptProps {
  history: ChatMessage[];
  streamingAgent?: string;
  streamingUser?: string;
  labels: LabelSet;
}

const EnglishTranscript: React.FC<EnglishTranscriptProps> = ({ 
    history, 
    streamingAgent, 
    streamingUser,
    labels 
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll whenever history or streaming text changes
  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history.length, streamingAgent, streamingUser]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900/50 rounded-b-xl border-t border-slate-800 backdrop-blur-sm">
       {/* Header */}
       <div className="flex-none px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center z-10">
         <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            {labels.transcriptTitle}
         </h3>
         <span className="text-[10px] text-slate-500 font-medium">{labels.transcriptSubtitle}</span>
       </div>

       {/* Scrollable Area */}
       <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm scrollbar-thin scrollbar-thumb-slate-700">
          {history.length === 0 && !streamingAgent && !streamingUser && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                  <p>{labels.waitingForConv}</p>
              </div>
          )}
          
          {/* Historical Messages */}
          {history.map((msg, idx) => (
             <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[95%] p-3 rounded-lg border shadow-sm ${
                    msg.role === 'user' 
                    ? 'border-slate-700 bg-slate-800/80 text-slate-200' 
                    : 'border-indigo-900/40 bg-indigo-950/30 text-indigo-100'
                }`}>
                   <p className="leading-relaxed whitespace-pre-wrap">
                       {msg.translatedText || msg.text}
                   </p>
                </div>
                <span className="text-[10px] text-slate-600 mt-1.5 px-1 font-medium tracking-wide">
                    {msg.role === 'user' ? `${labels.userRole} (En)` : `${labels.dojoRole} (En)`}
                </span>
             </div>
          ))}

          {/* User Streaming Indicator */}
          {streamingUser && (
             <div className="flex flex-col items-end animate-pulse">
                <div className="max-w-[95%] p-3 rounded-lg border border-dashed border-slate-600 bg-slate-800/50 text-slate-300">
                   <p className="leading-relaxed italic">
                       {streamingUser} ...
                   </p>
                </div>
                <span className="text-[10px] text-blue-400/70 mt-1.5 px-1">
                    {labels.userRole} (Listening...)
                </span>
             </div>
          )}

          {/* Agent Streaming Indicator */}
          {streamingAgent && (
             <div className="flex flex-col items-start animate-pulse">
                <div className="max-w-[95%] p-3 rounded-lg border border-dashed border-indigo-500/30 bg-indigo-900/10 text-indigo-300">
                   <p className="leading-relaxed italic">
                       {streamingAgent} ...
                   </p>
                </div>
                <span className="text-[10px] text-indigo-400/70 mt-1.5 px-1">
                    {labels.dojoRole} (Translating...)
                </span>
             </div>
          )}

          <div ref={bottomRef} className="h-1 flex-none" />
       </div>
    </div>
  );
};

export default EnglishTranscript;