import { ScoreBreakdown as ScoreBreakdownType } from '../../types/candidate';
import { Progress } from '../ui/Progress';
import { getScoreColor } from '../../lib/utils';

interface ScoreBreakdownProps {
  scores: ScoreBreakdownType;
}

export function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  const overallColors = getScoreColor(scores.overallScore);

  const breakdownItems = [
    { label: 'Skills Match', value: scores.skillsScore, weight: '40%' },
    { label: 'Experience Match', value: scores.experienceScore, weight: '25%' },
    { label: 'Semantic Relevance', value: scores.semanticScore, weight: '20%' },
    { label: 'AI Evaluation', value: scores.llmScore, weight: '15%' },
  ];

  return (
    <div className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-xl p-5">
      {/* Overall Score Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Overall Match
          </h4>
          <p className="text-xs text-slate-400">Weighted composite analysis</p>
        </div>
        <div className={`text-2xl font-black ${overallColors.text}`}>
          {scores.overallScore.toFixed(0)}%
        </div>
      </div>

      {/* Component Bars */}
      <div className="space-y-3">
        {breakdownItems.map((item, idx) => {
          const itemColor = getScoreColor(item.value);
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {item.label} <span className="text-[10px] text-slate-400 font-normal">({item.weight})</span>
                </span>
                <span className={`font-bold ${itemColor.text}`}>
                  {item.value.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={item.value}
                indicatorClassName={itemColor.bar}
                className="h-1.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
