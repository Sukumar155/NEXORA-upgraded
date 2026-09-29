import React from 'react';

interface PriorityRingProps {
  score: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export const PriorityRing: React.FC<PriorityRingProps> = ({
  score,
  size = 56,
  strokeWidth = 5,
  showLabel = false
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = '#126B34'; // Green
  let textColor = 'text-[#126B34]';
  let badgeBg = 'bg-[#126B34]/10';

  if (score >= 85) {
    strokeColor = '#B42318'; // Red
    textColor = 'text-[#B42318]';
    badgeBg = 'bg-[#B42318]/10';
  } else if (score >= 70) {
    strokeColor = '#A15C07'; // Amber
    textColor = 'text-[#A15C07]';
    badgeBg = 'bg-[#A15C07]/10';
  } else if (score >= 50) {
    strokeColor = '#1A3A6B'; // Blue
    textColor = 'text-[#1A3A6B]';
    badgeBg = 'bg-[#1A3A6B]/10';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E4E4E0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className={`absolute font-data font-bold text-sm ${textColor}`}>
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={`mt-1 text-[10px] font-bold font-data uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeBg} ${textColor}`}>
          AI SCORE
        </span>
      )}
    </div>
  );
};
