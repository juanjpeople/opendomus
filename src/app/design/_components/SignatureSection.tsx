"use client";

import { Button, Col, Flex, Row, Tag, Typography, theme } from "antd";
import { Boxes, HardDrive, Refrigerator, RotateCcw, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { House } from "@/components/illustrations/House";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/motion";
import { IconTile, NavCard, PulseDot } from "@/components/ui";
import { DemoBlock, DemoLabel, NoNavigate } from "./DemoBlock";

const RADII = [
  { factor: 1, use: "Tarjetas, fichas, botones grandes" },
  { factor: 1.5, use: "Paneles y pisos de ambiente" },
  { factor: 2, use: "Héroe, ambientes, visor de cámara" },
  { factor: 3, use: "Cierre de la landing" },
] as const;

/** Lo que hace que Refugio se reconozca. Cada pantalla nueva tiene que poder ponerse al lado de estas. */
export function SignatureSection() {
  const { token } = theme.useToken();
  const [replay, setReplay] = useState(0);

  return (
    <DemoBlock
      id="firma"
      title="Firma visual"
      description="Lo que hace que Refugio se reconozca de un vistazo. Antes de dar por terminada una pantalla, ponela al lado de estas piezas: si se ve más plana, le falta algo de acá."
      code={`
// Brillo de marca (lo pone AppShell en todo el contenido; los héroes lo repiten adentro):
background: \`radial-gradient(ellipse 70% 40% at 60% -5%, \${token.colorPrimaryBg}, transparent 70%)\`

// Cabecera de vidrio:
backdropFilter: "blur(12px)",
background: \`color-mix(in srgb, \${token.colorBgContainer} 75%, transparent)\`,
borderBottom: \`1px solid \${token.colorBorderSecondary}\`,

// Eyebrow legible también con marcas oscuras. La marca queda en el brillo y los acentos:
// Eyebrow + título héroe:
<Typography.Text strong style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}>Tu casa</Typography.Text>
<Typography.Title style={{ letterSpacing: "-0.035em", fontSize: "clamp(1.9rem, 4vw, 2.75rem)", lineHeight: 1.1 }}>Todo en orden</Typography.Title>

// Tarjeta que lleva a otra página (sube, el ícono gira, aparece la flecha):
<StaggerItem><NavCard href="/compras" icon={ShoppingCart} title="Lista de compras">…</NavCard></StaggerItem>

// Estado vivo:
<PulseDot tone="success" />
`}
    >
      <Flex justify="flex-end" style={{ marginBottom: 16 }}>
        <Button icon={<RotateCcw />} onClick={() => setReplay((n) => n + 1)}>
          Repetir animaciones
        </Button>
      </Flex>

      <Row gutter={[24, 32]} key={replay}>
        <Col xs={24}>
          <DemoLabel>Brillo de marca, cabecera de vidrio y título héroe (scrolleá: el contenido pasa por debajo de la cabecera)</DemoLabel>
          <div style={{ height: 300, overflowY: "auto", borderRadius: token.borderRadiusLG * 1.5, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgLayout }}>
            <Flex
              align="center"
              justify="space-between"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                height: 52,
                paddingInline: 16,
                backdropFilter: "blur(12px)",
                background: `color-mix(in srgb, ${token.colorBgContainer} 75%, transparent)`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Flex align="center" gap={8}>
                <HouseMark size={22} />
                <Typography.Text strong>Refugio</Typography.Text>
              </Flex>
              <Tag variant="filled" icon={<HardDrive />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                Este dispositivo
              </Tag>
            </Flex>
            <div style={{ padding: "32px 24px", background: `radial-gradient(ellipse 70% 40% at 60% -5%, ${token.colorPrimaryBg}, transparent 70%)` }}>
              <Typography.Text strong style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}>
                Martes 7 de octubre
              </Typography.Text>
              <Typography.Title style={{ margin: "6px 0 12px", letterSpacing: "-0.035em", fontSize: "clamp(1.9rem, 4vw, 2.75rem)", lineHeight: 1.1 }}>
                Buenas tardes
              </Typography.Title>
              <Flex align="center" gap={10} style={{ marginBottom: 24 }}>
                <PulseDot />
                <Typography.Text style={{ fontSize: token.fontSizeLG }}>Todo en orden en casa.</Typography.Text>
              </Flex>
              <Flex gap={12} wrap>
                {(["blue", "green", "orange", "purple", "cyan", "magenta"] as const).map((color) => (
                  <IconTile key={color} icon={Boxes} color={color} />
                ))}
              </Flex>
              <Typography.Paragraph type="secondary" style={{ margin: "24px 0 0", maxWidth: 520 }}>
                El resplandor arriba sale del color de marca (cambialo en Tokens y mirá). No es una imagen: es un gradiente, así que no pesa nada.
              </Typography.Paragraph>
            </div>
          </div>
        </Col>

        <Col xs={24}>
          <DemoLabel>NavCard: la tarjeta firma. Pasá el mouse: sube, el ícono gira y aparece la flecha</DemoLabel>
          <NoNavigate>
            <Stagger>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <StaggerItem style={{ height: "100%" }}>
                    <NavCard href="/inventario" icon={Boxes} title="Inventario">
                      <Flex align="baseline" gap={6}>
                        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          <AnimatedNumber value={128} />
                        </Typography.Text>
                        <Typography.Text type="secondary">productos</Typography.Text>
                      </Flex>
                      <Typography.Text type="secondary">en 9 contenedores</Typography.Text>
                    </NavCard>
                  </StaggerItem>
                </Col>
                <Col xs={24} md={12}>
                  <StaggerItem style={{ height: "100%" }}>
                    <NavCard href="/inventario#cocina" icon={Refrigerator} color="volcano" title="Cocina">
                      <Flex align="baseline" gap={6}>
                        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          <AnimatedNumber value={46} />
                        </Typography.Text>
                        <Typography.Text type="secondary">productos</Typography.Text>
                      </Flex>
                      <Typography.Text style={{ color: token.colorWarningText }}>3 para reponer</Typography.Text>
                    </NavCard>
                  </StaggerItem>
                </Col>
                <Col xs={24} md={12}>
                  <StaggerItem style={{ height: "100%" }}>
                    <NavCard href="/compras" icon={ShoppingCart} title="Lista de compras">
                      <Flex align="baseline" gap={6}>
                        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          <AnimatedNumber value={7} />
                        </Typography.Text>
                        <Typography.Text type="secondary">por comprar</Typography.Text>
                      </Flex>
                      <Typography.Text type="secondary">Lista abierta</Typography.Text>
                    </NavCard>
                  </StaggerItem>
                </Col>
              </Row>
            </Stagger>
          </NoNavigate>
        </Col>

        <Col xs={24} lg={12}>
          <DemoLabel>Radios: siempre múltiplos de borderRadiusLG (siguen la preferencia de redondeo)</DemoLabel>
          <Row gutter={[12, 12]}>
            {RADII.map(({ factor, use }) => (
              <Col key={factor} xs={12}>
                <Flex
                  vertical
                  justify="flex-end"
                  style={{
                    height: 96,
                    padding: 12,
                    borderRadius: token.borderRadiusLG * factor,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: `radial-gradient(ellipse at 85% 0%, ${token.colorPrimaryBg}, transparent 70%), ${token.colorBgContainer}`,
                  }}
                >
                  <Typography.Text strong>LG × {factor}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {use}
                  </Typography.Text>
                </Flex>
              </Col>
            ))}
          </Row>
          <Typography.Paragraph type="secondary" style={{ margin: "12px 0 0", fontSize: token.fontSizeSM }}>
            Bordes de 1px en colorBorderSecondary, sin sombras inventadas: si hace falta profundidad, boxShadowTertiary o boxShadowSecondary del tema.
          </Typography.Paragraph>
        </Col>

        <Col xs={24} lg={12}>
          <DemoLabel>Ilustración: trazo redondo de 3px, líneas en colorText, acentos de marca y ventanas cálidas</DemoLabel>
          <Flex align="center" gap={24} wrap>
            <div style={{ width: 220 }}>
              <House intro particles />
            </div>
            <Flex vertical gap={16}>
              <Flex align="center" gap={12}>
                <HouseMark size={40} />
                <Typography.Text type="secondary">Logo</Typography.Text>
              </Flex>
              <Flex align="center" gap={12}>
                <HouseMark size={40} loading />
                <Typography.Text type="secondary">Cargando (en lugar de un spinner)</Typography.Text>
              </Flex>
            </Flex>
          </Flex>
        </Col>
      </Row>
    </DemoBlock>
  );
}
