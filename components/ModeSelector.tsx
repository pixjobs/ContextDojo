import React from 'react';
import { ConversationMode } from '../types';

interface ModeSelectorProps {
  onSelect: (mode: ConversationMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelect }) => {
  const modes = [
    {
      id: 'topical',
      title: 'Topical Discussion',
      desc: 'Practice speaking clearly about specific subjects, hobbies, or current events.',
      icon: '💡',
      color: 'bg-emerald-600',
    },
    {
      id: 'social',
      title: 'Social Mixer',
      desc: 'Practice small talk, breaking the ice, and active listening.',
      icon: '🥂',
      color: 'bg-pink-600',
    },
    {
      id: 'debate',
      title: 'Deep Discussion',
      desc: 'Structure complex arguments and discuss philosophy or logic.',
      icon: '🧠',
      color: 'bg-purple-600',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <h2 className="text-3xl font-bold text-white mb-2">Choose Your Context</h2>
      <p className="text-slate-400 mb-8 text-center max-w-md">
        Select a scenario to start practicing your conversational flow.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id as ConversationMode)}
            className="group relative overflow-hidden rounded-2xl bg-slate-800 border border-slate-700 p-6 hover:border-slate-500 transition-all hover:shadow-2xl hover:-translate-y-1 text-left"
          >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl`}>
              {m.icon}
            </div>
            <div className={`w-12 h-12 ${m.color} rounded-lg flex items-center justify-center text-2xl mb-4 shadow-lg`}>
              {m.icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{m.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModeSelector;