"use client";

import { Menu } from "antd";
import { HomeOutlined, InboxOutlined, ToolOutlined, ShoppingCartOutlined, FormatPainterOutlined } from "@ant-design/icons";
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import React from 'react';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useAppStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));

  const items = [
    { label: "Inicio", key: "/", icon: <HomeOutlined /> },
    { label: "Alacena", key: "/alacena", icon: <InboxOutlined /> },
    { label: "Taller", key: "/taller", icon: <ToolOutlined /> },
    { label: "Compras", key: "/compras", icon: <ShoppingCartOutlined /> },
    { label: "Apariencia", key: "/design", icon: <FormatPainterOutlined /> },
  ];

  return (
    <Menu 
      mode="inline" 
      theme={isDarkMode ? 'dark' : 'light'}
      selectedKeys={[pathname || '/']} 
      onClick={({ key }) => router.push(key)}
      items={items} 
      style={{ borderRight: 0 }}
    />
  );
}
