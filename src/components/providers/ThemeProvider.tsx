"use client";

import { ConfigProvider, theme as antdTheme, App } from 'antd';
import esES from 'antd/locale/es_ES';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, brandColor, borderRadius } = useAppStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDarkMode = theme === 'dark' || 
    (theme === 'system' && isClient && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <ConfigProvider 
      locale={esES} 
      theme={{ 
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { 
          fontFamily: 'inherit',
          colorPrimary: brandColor,
          borderRadius: borderRadius,
        } 
      }}
    >
      <App>
        {children}
      </App>
    </ConfigProvider>
  );
}
