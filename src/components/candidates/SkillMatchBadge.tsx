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
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        matched
          ? isRequired
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white font-semibold shadow-2xs'
            : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700'
          : 'bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 line-through'
      )}
    >
      {matched ? (
        <Check className="h-3 w-3 shrink-0 stroke-[2.8]" />
      ) : (
        <X className="h-3 w-3 shrink-0 stroke-[2.8]" />
      )}
      <span>{skillName}</span>
      {!matched && isRequired && (
        <span className="text-[10px] text-neutral-800 dark:text-neutral-200 font-bold no-underline ml-0.5">(Required)</span>
      )}
    </span>
  );
}
