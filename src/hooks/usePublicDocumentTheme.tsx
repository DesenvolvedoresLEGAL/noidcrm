import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'noid-public-doc-theme';

type PublicTheme = 'light' | 'dark';

function readStored(): PublicTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Scoped theme control for public documents (proposals shared via public link).
 *
 * Public links must NOT inherit the CRM's `system` theme, otherwise smartphones
 * (usually in dark mode) render the light-designed proposal with unreadable text.
 * Defaults to light and lets the recipient opt into dark, persisting the choice
 * under a dedicated storage key so the internal CRM theme is untouched.
 */
export function usePublicDocumentTheme() {
  const [theme, setThemeState] = useState<PublicTheme>(() => readStored());

  // Apply to <html> while the public document is mounted, restore on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');

    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    return () => {
      if (hadDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
  }, [theme]);

  const setTheme = useCallback((next: PublicTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
