import { ScoreBreakdown as ScoreBreakdownType } from '../../types/candidate';
import { Progress } from '../ui/Progress';
import { ScoreRing } from '../ui/ScoreRing';
import { getScoreColor } from '../../lib/utils';

interface ScoreBreakdownProps {
  scores: ScoreBreakdownType;
  rank?: number | null;
}

export function ScoreBreakdown({ scores, rank }: ScoreBreakdownProps) {
  const breakdownItems = [
    { label: 'Skills Match', value: scores.skillsScore, weight: '40%' },
    { label: 'Experience Match', value: scores.experienceScore, weight: '25%' },
    { label: 'Semantic Relevance', value: scores.semanticScore, weight: '20%' },
    { label: 'AI Evaluation', value: scores.llmScore, weight: '15%' },
  ];

  return (
    <div className="space-y-5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 transition-colors">
      {/* Overall Score Header with Radial Score Gauge */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Overall Match
          </span>
          <h4 className="text-sm font-bold text-neutral-950 dark:text-white">
            Composite AI Scoring
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Weighted across 4 criteria
          </p>
        </div>

        <ScoreRing
          score={scores.overallScore}
          rank={rank}
          size="md"
          showRank={false}
        />
      </div>

      {/* Component Breakdown Progress Bars */}
      <div className="space-y-3.5">
        {breakdownItems.map((item, idx) => {
          const itemColor = getScoreColor(item.value);
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {item.label}{' '}
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    ({item.weight})
                  </span>
                </span>
                <span className="font-bold font-mono text-xs tabular-nums text-neutral-950 dark:text-white">
                  {item.value.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={item.value}
                indicatorClassName={itemColor.bar}
                className="h-1.5 bg-neutral-200 dark:bg-neutral-800"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
