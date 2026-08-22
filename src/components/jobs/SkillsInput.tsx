import React, { useState } from 'react';
import { Plus, X, Star } from 'lucide-react';
import { SkillPayload } from '../../types/job';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface SkillsInputProps {
  skills: SkillPayload[];
  onChange: (skills: SkillPayload[]) => void;
}

export function SkillsInput({ skills, onChange }: SkillsInputProps) {
  const [inputVal, setInputVal] = useState('');
  const [importance, setImportance] = useState<'required' | 'nice-to-have'>('required');

  const addSkill = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (!skills.some((s) => s.skill.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...skills, { skill: trimmed, importance }]);
    }
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill();
    }
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  const toggleImportance = (index: number) => {
    onChange(
      skills.map((s, i) =>
        i === index
          ? { ...s, importance: s.importance === 'required' ? 'nice-to-have' : 'required' }
          : s
      )
    );
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
        Required & Preferred Skills
      </label>

      {/* Input Row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. React Native, Rust, PostgreSQL (Press Enter to add)"
          className="flex-1 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white"
        />

        <Button
          type="button"
          variant={importance === 'required' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setImportance(importance === 'required' ? 'nice-to-have' : 'required')}
          title="Toggle requirement level"
          className="text-xs shrink-0"
        >
          <Star className={`h-3.5 w-3.5 ${importance === 'required' ? 'fill-current' : ''}`} />
          {importance === 'required' ? 'Required' : 'Nice-to-have'}
        </Button>

        <Button type="button" size="sm" onClick={addSkill} className="shrink-0">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Skills Chips */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl min-h-[48px] items-center">
          {skills.map((s, idx) => (
            <Badge
              key={idx}
              variant={s.importance === 'required' ? 'default' : 'secondary'}
              className="pl-2.5 pr-1.5 py-1 text-xs gap-1.5 cursor-pointer select-none"
              onClick={() => toggleImportance(idx)}
              title="Click to toggle required / nice-to-have"
            >
              <span>{s.skill}</span>
              <span className="text-[10px] opacity-75 font-normal">
                ({s.importance === 'required' ? 'Req' : 'Nice'})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSkill(idx);
                }}
                className="hover:bg-neutral-200/60 dark:hover:bg-neutral-700 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
