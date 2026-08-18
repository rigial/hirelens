import { Check, X } from 'lucide-react';
import { MatchedSkill } from '../../types/candidate';
import { cn } from '../../lib/utils';

interface SkillMatchBadgeProps {
  skill: MatchedSkill | string;
  matched?: boolean;
}

export function SkillMatchBadge({ skill, matched = true }: SkillMatchBadgeProps) {
  const skillName = typeof skill === 'string' ? skill : skill.skill;
  const isRequired = typeof skill === 'string' ? true : skill.importance === 'required';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        matched
          ? isRequired
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-slate-50 text-slate-700 border-slate-200'
          : 'bg-rose-50 text-rose-800 border-rose-200 line-through opacity-80'
      )}
    >
      {matched ? (
        <Check className="h-3 w-3 text-emerald-600 shrink-0 stroke-[2.5]" />
      ) : (
        <X className="h-3 w-3 text-rose-500 shrink-0 stroke-[2.5]" />
      )}
      <span>{skillName}</span>
      {!matched && isRequired && (
        <span className="text-[10px] text-rose-600 font-semibold no-underline">(Required)</span>
      )}
    </span>
  );
}
