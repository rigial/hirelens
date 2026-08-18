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
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span>AI Qualitative Evaluation</span>
        </div>

        {summary && (
          <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-indigo-50">
            {summary}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Key Strengths
              </h5>
              <ul className="space-y-1.5">
                {strengths.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-600 flex items-start gap-2 bg-emerald-50/40 border border-emerald-100/60 rounded-md p-2"
                  >
                    <span className="text-emerald-500 font-bold leading-none mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {concerns.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Areas of Review
              </h5>
              <ul className="space-y-1.5">
                {concerns.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-600 flex items-start gap-2 bg-amber-50/40 border border-amber-100/60 rounded-md p-2"
                  >
                    <span className="text-amber-500 font-bold leading-none mt-0.5">•</span>
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
