import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { LabelSet } from '../constants/translations';

interface ChatInterfaceProps {
  history: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  streamingMessage?: string | null; // Agent streaming
  streamingUserText?: string | null; // User streaming
  labels: LabelSet;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  history, 
  onSendMessage, 
  isLoading, 
  streamingMessage,
  streamingUserText,
  labels
}) => {
  const [input, setInput] = useState('');
  const endOfMsgRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  useEffect(() => {
    endOfMsgRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streamingMessage, streamingUserText]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <h3 className="text-slate-200 font-semibold text-sm tracking-wide">Transcript</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {history.length === 0 && !streamingUserText && (
           <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
               <div className="text-4xl mb-4">👋</div>
               <p className="text-slate-400 text-sm">{labels.sayHello}</p>
           </div>
        )}
        
        {/* Render History */}
        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[10px] text-slate-500 mb-1 px-1 uppercase tracking-wider">
                {msg.role === 'user' ? labels.you : labels.dojo}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Render Streaming User Text */}
        {streamingUserText && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-blue-400 mb-1 px-1 uppercase tracking-wider animate-pulse">{labels.listening}</span>
            <div className="max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none italic backdrop-blur-sm">
              {streamingUserText}
              <span className="inline-block w-1.5 h-3 ml-1 bg-blue-400 animate-pulse"></span>
            </div>
          </div>
        )}

        {/* Render Streaming Agent Response */}
        {streamingMessage && (
           <div className="flex flex-col items-start">
             <span className="text-[10px] text-emerald-400 mb-1 px-1 uppercase tracking-wider animate-pulse">{labels.thinking}</span>
             <div className="max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed bg-slate-800/80 border border-emerald-500/30 text-slate-200 rounded-tl-none backdrop-blur-sm">
               {streamingMessage}
               <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-400 animate-pulse"></span>
             </div>
           </div>
        )}

        {/* Loading Dots (Text Mode) */}
        {isLoading && !streamingMessage && !streamingUserText && (
          <div className="flex flex-col items-start">
             <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          </div>
        )}
        <div ref={endOfMsgRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-slate-900/50 border-t border-slate-800">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={labels.typePlaceholder}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-600 text-sm shadow-inner transition-all"
            disabled={isLoading || !!streamingMessage || !!streamingUserText}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !!streamingMessage || !!streamingUserText}
            className="absolute right-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.289Z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;