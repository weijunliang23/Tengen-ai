import { useEffect, useState } from 'react';

/** 响应式断点 hook：与 styles.css 中 @media (max-width: 1020px) 保持一致 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 移动端断点（窄屏 / 手机） */
export const MOBILE_QUERY = '(max-width: 1020px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
