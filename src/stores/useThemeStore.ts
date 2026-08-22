import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => () => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  // Read initial preference from localStorage, defaulting to 'system'
  let initialTheme: Theme = 'system';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('hirelens_theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      initialTheme = saved;
    }
  }

  const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
  applyThemeToDocument(resolved);

  return {
    theme: initialTheme,
    resolvedTheme: resolved,

    setTheme: (theme: Theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hirelens_theme', theme);
      }
      const resolved = theme === 'system' ? getSystemTheme() : theme;
      applyThemeToDocument(resolved);
      set({ theme, resolvedTheme: resolved });
    },

    initializeTheme: () => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e: MediaQueryListEvent) => {
        const currentTheme = get().theme;
        if (currentTheme === 'system') {
          const newResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
          applyThemeToDocument(newResolved);
          set({ resolvedTheme: newResolved });
        }
      };

      mediaQuery.addEventListener('change', handleSystemChange);

      // Re-apply on initialization
      const currentTheme = get().theme;
      const initialResolved = currentTheme === 'system' ? getSystemTheme() : currentTheme;
      applyThemeToDocument(initialResolved);
      set({ resolvedTheme: initialResolved });

      return () => {
        mediaQuery.removeEventListener('change', handleSystemChange);
      };
    },
  };
});
