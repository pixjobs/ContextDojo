import React from 'react';

interface TangentGaugeProps {
  score: number;
}

const TangentGauge: React.FC<TangentGaugeProps> = ({ score }) => {
  // Color interpolation based on score
  // 0-30: Green, 31-70: Yellow, 71-100: Red
  let colorClass = "bg-green-500";
  let statusText = "On Track";
  
  if (score > 30 && score <= 70) {
    colorClass = "bg-yellow-500";
    statusText = "Drifting...";
  } else if (score > 70) {
    colorClass = "bg-red-500";
    statusText = "Tangent Alert!";
  }

  // Calculate circumference for SVG circle
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
      <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Focus Meter</h3>
      
      <div className="relative w-32 h-32">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-slate-700"
          />
          {/* Progress Circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-out ${colorClass.replace('bg-', 'text-')}`}
          />
        </svg>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>
      
      <div className={`mt-4 px-3 py-1 rounded-full text-xs font-bold ${colorClass} text-slate-900`}>
        {statusText}
      </div>
    </div>
  );
};

export default TangentGauge;
