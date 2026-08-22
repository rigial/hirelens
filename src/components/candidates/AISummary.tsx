import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface AISummaryProps {
  summary: string | null;
  strengths: string[];
  concerns: string[];
}

export function AISummary({ summary, strengths, concerns }: AISummaryProps) {
  if (!summary && strengths.length === 0 && concerns.length === 0) {
    return null;
  }

  return (
    <Card className="border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-neutral-950 dark:text-white font-bold text-sm">
          <Sparkles className="h-4 w-4 text-neutral-900 dark:text-white" />
          <span>AI Qualitative Evaluation</span>
        </div>

        {summary && (
          <p className="text-xs text-neutral-900 dark:text-neutral-100 leading-relaxed bg-neutral-100/80 dark:bg-neutral-800/80 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
            {summary}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-neutral-950 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle2 className="h-3.5 w-3.5 text-neutral-900 dark:text-white" /> Key Strengths
              </h5>
              <ul className="space-y-1.5">
                {strengths.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-neutral-900 dark:text-neutral-100 flex items-start gap-2 bg-neutral-100/70 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2.5"
                  >
                    <span className="text-neutral-900 dark:text-white font-bold leading-none mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {concerns.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-neutral-950 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className="h-3.5 w-3.5 text-neutral-900 dark:text-white" /> Areas of Review
              </h5>
              <ul className="space-y-1.5">
                {concerns.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-neutral-900 dark:text-neutral-100 flex items-start gap-2 bg-neutral-100/70 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2.5"
                  >
                    <span className="text-neutral-900 dark:text-white font-bold leading-none mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
