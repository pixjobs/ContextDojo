import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface EnglishTranscriptProps {
  history: ChatMessage[];
  streamingAgent?: string;
}

const EnglishTranscript: React.FC<EnglishTranscriptProps> = ({ history, streamingAgent }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streamingAgent]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur-sm overflow-hidden relative">
       <div className="absolute top-0 left-0 right-0 p-3 bg-slate-900/80 border-b border-slate-800 z-10 flex justify-between items-center">
         <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            English Transcript
         </h3>
         <span className="text-[10px] text-slate-600">Auto-Translated</span>
       </div>

       <div className="flex-1 overflow-y-auto p-4 pt-12 space-y-4 font-mono text-sm scrollbar-thin scrollbar-thumb-slate-700">
          {history.length === 0 && !streamingAgent && (
              <div className="text-center text-slate-600 italic mt-10">
                  Waiting for conversation...
              </div>
          )}
          
          {history.map((msg, idx) => (
             <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] p-3 rounded-lg border ${
                    msg.role === 'user' 
                    ? 'border-slate-700 bg-slate-800/50 text-slate-300' 
                    : 'border-indigo-900/30 bg-indigo-900/10 text-indigo-200'
                }`}>
                   <p className="leading-relaxed">
                       {msg.translatedText || msg.text}
                   </p>
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1">
                    {msg.role === 'user' ? 'User (En)' : 'Dojo (En)'}
                </span>
             </div>
          ))}

          {/* Render Streaming Agent Text in Transcript */}
          {streamingAgent && (
             <div className="flex flex-col items-start animate-pulse opacity-75">
                <div className="max-w-[90%] p-3 rounded-lg border border-dashed border-indigo-500/30 bg-indigo-900/5 text-indigo-300">
                   <p className="leading-relaxed italic">
                       {streamingAgent} ...
                   </p>
                </div>
                <span className="text-[10px] text-indigo-500 mt-1 px-1">
                    Dojo (Translating...)
                </span>
             </div>
          )}

          <div ref={bottomRef} />
       </div>
    </div>
  );
};

export default EnglishTranscript;