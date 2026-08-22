import React from 'react';
import { cn, getScoreColor } from '../../lib/utils';

export interface ScoreRingProps extends React.HTMLAttributes<HTMLDivElement> {
  score: number;
  rank?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPercentSign?: boolean;
  showRank?: boolean;
}

export function ScoreRing({
  score,
  rank,
  size = 'md',
  showPercentSign = true,
  showRank = true,
  className,
  ...props
}: ScoreRingProps) {
  const normalizedScore = Math.min(100, Math.max(0, score));
  const scoreColors = getScoreColor(normalizedScore);

  const sizeConfigs = {
    sm: {
      dimension: 42,
      radius: 17,
      strokeWidth: 3.5,
      scoreFontSize: 'text-xs',
      percentFontSize: 'text-[9px]',
      rankFontSize: 'text-[9px]',
    },
    md: {
      dimension: 54,
      radius: 22,
      strokeWidth: 4,
      scoreFontSize: 'text-sm font-extrabold',
      percentFontSize: 'text-[10px] font-bold',
      rankFontSize: 'text-[10px]',
    },
    lg: {
      dimension: 72,
      radius: 30,
      strokeWidth: 5,
      scoreFontSize: 'text-xl font-black',
      percentFontSize: 'text-xs font-bold',
      rankFontSize: 'text-[11px]',
    },
    xl: {
      dimension: 96,
      radius: 40,
      strokeWidth: 6,
      scoreFontSize: 'text-3xl font-black',
      percentFontSize: 'text-sm font-bold',
      rankFontSize: 'text-xs',
    },
  };

  const config = sizeConfigs[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div
      className={cn('inline-flex flex-col items-center justify-center shrink-0', className)}
      role="progressbar"
      aria-valuenow={Math.round(normalizedScore)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Candidate match score: ${Math.round(normalizedScore)}%${rank ? `, Rank ${rank}` : ''}`}
      {...props}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: config.dimension, height: config.dimension }}
      >
        <svg
          className="w-full h-full -rotate-90 transform overflow-visible"
          viewBox={`0 0 ${config.dimension} ${config.dimension}`}
        >
          {/* Subtle Background Track */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={config.radius}
            fill="transparent"
            strokeWidth={config.strokeWidth}
            className="stroke-neutral-200 dark:stroke-neutral-800 transition-colors"
          />

          {/* Foreground Animated Progress Arc */}
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={config.radius}
            fill="transparent"
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(scoreColors.stroke, 'transition-all duration-700 ease-out')}
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <div className="flex items-baseline tracking-tight">
            <span
              className={cn(
                'tabular-nums text-neutral-950 dark:text-white leading-none font-sans',
                config.scoreFontSize
              )}
            >
              {normalizedScore.toFixed(0)}
            </span>
            {showPercentSign && (
              <span
                className={cn(
                  'text-neutral-500 dark:text-neutral-400 leading-none ml-0.5',
                  config.percentFontSize
                )}
              >
                %
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rank Indicator */}
      {showRank && rank !== undefined && rank !== null && (
        <span
          className={cn(
            'mt-1 font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-tight',
            config.rankFontSize
          )}
        >
          #{rank}
        </span>
      )}
    </div>
  );
}
