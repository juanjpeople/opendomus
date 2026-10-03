"use client";

import { useAppStore, Role } from '@/store/useAppStore';
import { Navigation } from "@/components/Navigation";
import { Select, Layout, Switch, Space, Typography } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import React from 'react';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

export function AppSkinManager({ children }: { children: React.ReactNode }) {
  const { skin, currentUser, login, theme, setTheme } = useAppStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ minHeight: '100vh', background: 'var(--ant-color-bg-layout)' }} />;
  }

  const role = currentUser?.role || 'admin';
  const effectiveSkin = skin === 'auto' 
    ? (role === 'kid' ? 'kids' : 'desktop')
    : skin;

  const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const Toolbar = () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Switch 
        checkedChildren={<MoonOutlined />} 
        unCheckedChildren={<SunOutlined />} 
        checked={isDarkMode}
        onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      />
      <Select 
        value={role} 
        onChange={(val: Role) => login(currentUser?.name || 'User', val)}
        options={[
          { label: '👨‍🔧 Admin', value: 'admin' },
          { label: '👶 Niño', value: 'kid' }
        ]} 
        style={{ width: 120 }}
      />
    </div>
  );

  if (effectiveSkin === 'kids') {
    return (
      <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#2b1d00' : '#FFFBE6' }}>
        <Header style={{ background: 'transparent', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 24px' }}>
          <Toolbar />
        </Header>
        <Content style={{ padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ color: '#FA8C16', fontSize: 40, fontWeight: 900, margin: 0 }}>🏰 OpenDomus Play</h1>
            <p style={{ color: '#FAAD14', fontSize: 18, fontWeight: 'bold' }}>¡Modo Explorador!</p>
          </div>
          <main style={{ maxWidth: 800, margin: '0 auto', background: isDarkMode ? '#141414' : 'white', borderRadius: 24, padding: 24, border: '4px solid #FFE58F' }}>
            {children}
          </main>
        </Content>
      </Layout>
    );
  }

  // Desktop / Mobile Default Skin using Antd Layout
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        breakpoint="md"
        collapsedWidth="0"
        theme={isDarkMode ? 'dark' : 'light'}
        style={{ borderRight: isDarkMode ? '1px solid #333' : '1px solid #f0f0f0' }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ fontSize: 20, color: 'var(--ant-color-primary)' }}>OpenDomus</Text>
        </div>
        <Navigation />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: 'var(--ant-color-bg-container)', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
          <Toolbar />
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
