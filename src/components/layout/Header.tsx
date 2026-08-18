import { Cpu, HardDrive } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Badge } from '../ui/Badge';

export function Header() {
  const { systemInfo } = useSettingsStore();

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xs px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-800">HR Talent Intelligence</h2>
      </div>

      <div className="flex items-center gap-4">
        {systemInfo && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              {systemInfo.hasGpu ? 'GPU Accelerated' : 'CPU Mode'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
              {systemInfo.ramGb.toFixed(0)} GB RAM
            </span>
            <Badge variant="indigo" className="ml-1 text-[10px] uppercase">
              {systemInfo.recommendedModelTier} Tier
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}
