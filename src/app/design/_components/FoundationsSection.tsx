"use client";

import { Button, Col, ColorPicker, Flex, Row, Slider, Space, Typography, theme } from "antd";
import {
  Bell,
  Check,
  House,
  Palette,
  Plus,
  Refrigerator,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";
import { ThemeModeSwitch } from "@/components/layout/HeaderActions";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { BRAND_PRESETS, DEFAULT_PREFERENCES } from "@/store/usePreferencesStore";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const APP_ICONS = { House, Refrigerator, Wrench, ShoppingCart, Palette, UserRound, Bell, Search, Plus, Trash2, Settings };

const PRINCIPLES = [
  ["Esta página es el estándar", "Nada se usa en una pantalla si antes no está acá. Primero se arma o se arregla la pieza en @/components/ui, después se muestra acá con sus variantes, y recién ahí se adopta. Una prueba (design-lint) verifica que todo lo exportado esté documentado."],
  ["Componentes", "antd primero. Si un patrón se repite 2+ veces, se extrae a @/components/ui. Antes de crear uno, revisá Componentes propios y Flujos."],
  ["Colores y espacios", "Siempre desde theme.useToken(). Nunca hex escritos a mano: rompen el modo oscuro y el color de marca."],
  ["Íconos", "Solo lucide-react. El tamaño lo hereda del texto (1em) vía LucideProvider."],
  ["Permisos", "Preguntar por permisos (can, usePermission, <Can>), nunca por rol. La matriz vive en lib/auth/permissions.ts."],
  ["Datos", "La UI no escribe en db: usa los hooks del feature, que llaman al servicio (y el servicio verifica permisos)."],
  ["Páginas", "page.tsx es Server Component (metadata) y renderiza componentes cliente del feature."],
  ["Textos", "Nunca escritos en el componente: t(\"clave\") con useT(). El diccionario base es i18n/messages/es.ts; TypeScript exige la misma clave en cada idioma. Los errores de dominio llevan clave, no texto."],
  ["Navegación", "Toda página se registra en lib/navigation/routes.ts: de ahí salen el menú, las migas, la búsqueda (Ctrl+K), los recientes y el título de la pestaña."],
  ["Historial", "Cada cambio de datos llama a recordActivity() dentro de la transacción del servicio. Sin registro no hay cambio."],
  ["Preferencias", "Por perfil: usePreferences() / useSetPreference(), nunca el store directo. Lo que se lee de localStorage se valida."],
  ["Movimiento", "Usar @/components/motion (Reveal, Stagger, AnimatedNumber) y los tokens de lib/motion (DURATION, SPRING, HOVER_LIFT, TAP). Corto, solo transform/opacity, nunca bloquea una acción. Toda pantalla entra en cascada y todo lo que se toca responde."],
] as const;

const STRUCTURE = `
src/
  app/                      rutas. page.tsx finito; _components/ = privado de la ruta
  components/
    ui/                     componentes reutilizables (todos documentados en /design)
    auth/                   Can, RequirePermission
    layout/                 AppShell, Navigation, HeaderActions, ProfilePicker
    providers/              ThemeProvider
    motion/                 Reveal, Stagger, AnimatedNumber
    illustrations/          House, HouseMark
  features/<modulo>/
    domain.ts               tipos, reglas y validación (sin React ni DB)
    service.ts              único punto que escribe en la DB + chequeo de permisos
    hooks.ts                lecturas reactivas y acciones para la UI
    components/             UI específica del módulo
  i18n/                     config, messages/<idioma>.ts, useT(), formatos (fechas, números)
  lib/                      auth/, navigation/routes.ts, db.ts, errors.ts, motion.ts
  hooks/ · store/           hooks y stores globales
`;

export function FoundationsSection() {
  return (
    <>
      <DemoBlock
        id="principios"
        title="Principios"
        description="Las reglas que hacen que el proyecto se mantenga consistente. Si algo no encaja, se discute y se actualiza acá."
        code={STRUCTURE}
      >
        <Flex vertical gap={12}>
          {PRINCIPLES.map(([title, text]) => (
            <Flex key={title} gap={12} align="baseline">
              <Typography.Text type="success">
                <Check />
              </Typography.Text>
              <Typography.Text>
                <Typography.Text strong>{title}: </Typography.Text>
                {text}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
      </DemoBlock>

      <TokensBlock />

      <DemoBlock
        id="tipografia"
        title="Tipografía e íconos"
        description="Typography de antd para todo texto. Los íconos se alinean y escalan con el texto que los rodea."
        code={`
import { Typography } from "antd";
import { Wrench } from "lucide-react";

<Typography.Title level={3}>Título</Typography.Title>
<Typography.Text type="secondary">Texto secundario</Typography.Text>
<Button icon={<Wrench />}>Con ícono</Button>
`}
      >
        <Typography.Title level={1} style={{ marginTop: 0 }}>
          Título 1
        </Typography.Title>
        <Typography.Title level={3}>Título 3</Typography.Title>
        <Typography.Title level={5}>Título 5</Typography.Title>
        <Space wrap size="middle" style={{ marginBottom: 24 }}>
          <Typography.Text>Normal</Typography.Text>
          <Typography.Text strong>Strong</Typography.Text>
          <Typography.Text type="secondary">Secondary</Typography.Text>
          <Typography.Text type="success">Success</Typography.Text>
          <Typography.Text type="warning">Warning</Typography.Text>
          <Typography.Text type="danger">Danger</Typography.Text>
          <Typography.Text code>code</Typography.Text>
          <Typography.Text keyboard>Ctrl</Typography.Text>
          <Typography.Link>Link</Typography.Link>
        </Space>
        <DemoLabel>Íconos de la app (lucide-react)</DemoLabel>
        <Row gutter={[8, 16]}>
          {Object.entries(APP_ICONS).map(([name, Icon]) => (
            <Col key={name} xs={8} sm={6} md={4}>
              <Flex vertical align="center" gap={4}>
                <span style={{ fontSize: 24, display: "inline-flex" }}>
                  <Icon />
                </span>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {name}
                </Typography.Text>
              </Flex>
            </Col>
          ))}
        </Row>
      </DemoBlock>
    </>
  );
}


const SEMANTIC_TOKENS = [
  "colorPrimary",
  "colorSuccess",
  "colorWarning",
  "colorError",
  "colorInfo",
  "colorText",
  "colorTextSecondary",
  "colorBgLayout",
  "colorBgContainer",
  "colorBorder",
  "colorFillTertiary",
] as const;

function TokensBlock() {
  const { token } = theme.useToken();
  const { brandColor, borderRadius } = usePreferences();
  const setPreference = useSetPreference();
  const setBrandColor = (color: string) => setPreference("brandColor", color);
  const setBorderRadius = (radius: number) => setPreference("borderRadius", radius);
  const resetAppearance = () => {
    setBrandColor(DEFAULT_PREFERENCES.brandColor);
    setBorderRadius(DEFAULT_PREFERENCES.borderRadius);
  };

  return (
    <DemoBlock
      id="tokens"
      title="Tokens de diseño"
      description="Cambiá los valores y mirá cómo reacciona toda la app. Los colores semánticos se derivan automáticamente para claro y oscuro."
      code={`
import { theme } from "antd";

function MiComponente() {
  const { token } = theme.useToken();
  return (
    <div style={{
      background: token.colorBgContainer,
      border: \`1px solid \${token.colorBorderSecondary}\`,
      borderRadius: token.borderRadiusLG,
      padding: token.padding,
    }} />
  );
}
`}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <DemoLabel>Color de marca</DemoLabel>
          <Space wrap>
            <ColorPicker
              value={brandColor}
              onChangeComplete={(color) => setBrandColor(color.toHexString())}
              presets={[{ label: "Sugeridos", colors: [...BRAND_PRESETS] }]}
              showText
            />
            {BRAND_PRESETS.map((color) => (
              <Button
                key={color}
                shape="circle"
                size="small"
                aria-label={`Usar ${color}`}
                onClick={() => setBrandColor(color)}
                style={{ background: color, borderColor: color }}
              />
            ))}
          </Space>
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>Redondeo base: {borderRadius}px</DemoLabel>
          <Slider min={0} max={20} value={borderRadius} onChange={setBorderRadius} marks={{ 0: "0", 8: "8", 20: "20" }} />
        </Col>
        <Col xs={24}>
          <Flex gap={16} align="center" wrap>
            <DemoLabel>Tema</DemoLabel>
            <ThemeModeSwitch />
            <Button
              onClick={resetAppearance}
              disabled={brandColor === DEFAULT_PREFERENCES.brandColor && borderRadius === DEFAULT_PREFERENCES.borderRadius}
            >
              Restaurar valores
            </Button>
          </Flex>
        </Col>
      </Row>

      <DemoLabel>Tokens semánticos (valores actuales)</DemoLabel>
      <Row gutter={[12, 12]}>
        {SEMANTIC_TOKENS.map((name) => (
          <Col key={name} xs={12} sm={8} md={6}>
            <Flex align="center" gap={8}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: token.borderRadiusSM,
                  background: token[name],
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              />
              <Flex vertical style={{ minWidth: 0 }}>
                <Typography.Text style={{ fontSize: 12 }} ellipsis>
                  {name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                  {token[name]}
                </Typography.Text>
              </Flex>
            </Flex>
          </Col>
        ))}
      </Row>
    </DemoBlock>
  );
}
