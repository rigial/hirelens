import { Cpu, HardDrive, Sun, Moon, Laptop } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useThemeStore, Theme } from '../../stores/useThemeStore';
import { Badge } from '../ui/Badge';

export function Header() {
  const { systemInfo } = useSettingsStore();
  const { theme, setTheme } = useThemeStore();

  const handleCycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getThemeLabel = (t: Theme) => {
    switch (t) {
      case 'system':
        return 'System';
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
    }
  };

  return (
    <header className="h-16 border-b border-neutral-200/90 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs px-8 flex items-center justify-between shrink-0 z-10 transition-colors">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
          HR Talent Intelligence
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {systemInfo && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              {systemInfo.hasGpu ? 'GPU Accelerated' : 'CPU Mode'}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              {systemInfo.ramGb.toFixed(0)} GB RAM
            </span>
            <Badge variant="secondary" className="ml-1 text-[10px] uppercase font-mono">
              {systemInfo.recommendedModelTier} Tier
            </Badge>
          </div>
        )}

        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

        {/* Theme Quick Toggle */}
        <button
          onClick={handleCycleTheme}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors border border-neutral-200/80 dark:border-neutral-700 cursor-pointer"
          title={`Current Theme: ${getThemeLabel(theme)} (Click to switch)`}
          aria-label={`Current Theme: ${getThemeLabel(theme)}`}
        >
          {theme === 'system' && <Laptop className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />}
          {theme === 'light' && <Sun className="h-3.5 w-3.5 text-neutral-800" />}
          {theme === 'dark' && <Moon className="h-3.5 w-3.5 text-neutral-200" />}
          <span className="text-[11px] capitalize">{getThemeLabel(theme)}</span>
        </button>
      </div>
    </header>
  );
}
