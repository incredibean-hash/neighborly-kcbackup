'use client';

import { useEffect } from 'react';

const APPLE_ICONS: Record<string,string> = {
  "aim": "/install-icons/aim-180.png",
  "air-force": "/install-icons/air-force-180.png",
  "army": "/install-icons/army-180.png",
  "chiefs": "/install-icons/chiefs-180.png",
  "city-fountains": "/install-icons/city-fountains-180.png",
  "cowtown": "/install-icons/cowtown-180.png",
  "kc-bbq": "/install-icons/kc-bbq-180.png",
  "kc-current": "/install-icons/kc-current-180.png",
  "kc-sunset": "/install-icons/kc-sunset-180.png",
  "kcfd": "/install-icons/kcfd-180.png",
  "kcpd": "/install-icons/kcpd-180.png",
  "marines": "/install-icons/marines-180.png",
  "navy": "/install-icons/navy-180.png",
  "pip-boy": "/install-icons/pip-boy-180.png",
  "royals": "/install-icons/royals-180.png",
  "space": "/install-icons/space-180.png",
  "sporting": "/install-icons/sporting-180.png",
};

const DEFAULT_THEME = 'royals';

export default function ThemeInstallIcon() {
  useEffect(() => {
    const apply = () => {
      const saved = localStorage.getItem('nkc_theme');
      const theme = saved && APPLE_ICONS[saved] ? saved : DEFAULT_THEME;

      let manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if(!manifest){
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      // The theme query changes the manifest URL so Chromium fetches the
      // selected theme's icon instead of reusing the previous manifest.
      manifest.href = `/api/manifest?theme=${encodeURIComponent(theme)}`;

      let apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
      if(!apple){
        apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        document.head.appendChild(apple);
      }
      apple.href = APPLE_ICONS[theme] || '/apple-touch-icon.png';
    };

    apply();
    window.addEventListener('nkc-theme-change', apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener('nkc-theme-change', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);

  return null;
}
