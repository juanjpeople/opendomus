"use client";

import { Button, Col, Flex, Row, Table, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { RotateCcw, Shuffle } from "lucide-react";
import { useState } from "react";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { DURATION, EASE_OUT, HOVER_LIFT, SPRING, STAGGER, TAP } from "@/lib/motion";
import { DemoBlock, DemoLabel } from "./DemoBlock";

/** Los valores salen del código real: si cambia lib/motion.ts, cambia esta tabla. */
const TOKENS = [
  { name: "DURATION", value: DURATION, use: "fast: indicadores y salidas · base: entradas (Reveal, página) · slow: ilustraciones" },
  { name: "EASE_OUT", value: EASE_OUT, use: "Curva de toda entrada: arranca rápido y frena al final" },
  { name: "SPRING.snappy", value: SPRING.snappy, use: "Hover, tap, indicadores, filas que entran" },
  { name: "SPRING.soft", value: SPRING.soft, use: "Lo que se acomoda: barras, burbujas, portadas" },
  { name: "STAGGER", value: STAGGER, use: "Separación entre elementos de una lista escalonada" },
  { name: "HOVER_LIFT", value: HOVER_LIFT, use: "Cuánto sube lo que se puede tocar (px)" },
  { name: "TAP", value: TAP, use: "Escala al apretar" },
];

const LIFTS = [
  { key: "hero", label: "hero", hint: "Perfiles, caminos de inicio" },
  { key: "card", label: "card", hint: "Tarjetas y fichas" },
  { key: "chip", label: "chip", hint: "Opciones, pestañas, eventos" },
] as const;

export function MotionSection() {
  const { token } = theme.useToken();
  const [replay, setReplay] = useState(0);
  const [count, setCount] = useState(42);
  const [tab, setTab] = useState("semana");

  const box = {
    padding: 16,
    borderRadius: token.borderRadiusLG,
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    textAlign: "center" as const,
  };

  return (
    <DemoBlock
      id="movimiento"
      title="Movimiento"
      description="La app se siente viva pero nunca hace esperar: animaciones cortas, solo transform y opacity, y todo respeta 'reducir movimiento' (MotionConfig en ThemeProvider, más la preferencia de la app). Tiempos, curvas y distancias salen de lib/motion.ts: no se escriben números sueltos."
      code={`
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

<Reveal>Entra con fade + subida</Reveal>
<Reveal inView>Entra cuando aparece en pantalla</Reveal>

<Stagger>
  <Row gutter={16}>
    {items.map((item) => (
      <Col key={item.id}><StaggerItem>...</StaggerItem></Col>
    ))}
  </Row>
</Stagger>

<AnimatedNumber value={total} />   {/* cuenta hasta el valor, sin re-renders por frame */}
<motion.div whileHover={{ y: HOVER_LIFT.card }} whileTap={{ scale: TAP.card }} transition={SPRING.snappy} />

// Indicador que se desliza entre opciones: un solo elemento con layoutId.
{selected && <motion.span layoutId="indicador" transition={SPRING.snappy} />}
`}
    >
      <DemoLabel>Tokens (valores actuales de lib/motion.ts)</DemoLabel>
      <Table
        rowKey="name"
        size="small"
        pagination={false}
        scroll={{ x: true }}
        style={{ marginBottom: 24 }}
        dataSource={TOKENS}
        columns={[
          { title: "Token", dataIndex: "name", render: (name: string) => <Typography.Text code>{name}</Typography.Text> },
          {
            title: "Valor",
            dataIndex: "value",
            render: (value: unknown) => (
              <Typography.Text style={{ fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM }}>{JSON.stringify(value)}</Typography.Text>
            ),
          },
          { title: "Para qué", dataIndex: "use", render: (use: string) => <Typography.Text type="secondary">{use}</Typography.Text> },
        ]}
      />

      <Flex justify="flex-end" style={{ marginBottom: 16 }}>
        <Button icon={<RotateCcw />} onClick={() => setReplay((n) => n + 1)}>
          Repetir animaciones
        </Button>
      </Flex>
      <Row gutter={[24, 24]} key={replay}>
        <Col xs={24} md={8}>
          <DemoLabel>Reveal</DemoLabel>
          <Reveal>
            <div style={box}>Entra y se acomoda</div>
          </Reveal>
        </Col>
        <Col xs={24} md={16}>
          <DemoLabel>Stagger + StaggerItem</DemoLabel>
          <Stagger>
            <Row gutter={8}>
              {[1, 2, 3, 4].map((n) => (
                <Col key={n} span={6}>
                  <StaggerItem style={box}>{n}</StaggerItem>
                </Col>
              ))}
            </Row>
          </Stagger>
        </Col>

        <Col xs={24}>
          <DemoLabel>HOVER_LIFT + TAP: pasá el mouse y apretá cada una</DemoLabel>
          <Row gutter={[12, 12]}>
            {LIFTS.map(({ key, label, hint }) => (
              <Col key={key} xs={24} sm={8}>
                <motion.div
                  whileHover={{ y: HOVER_LIFT[key] }}
                  whileTap={{ scale: key === "chip" ? TAP.control : TAP.card }}
                  transition={SPRING.snappy}
                  style={{
                    cursor: "pointer",
                    padding: key === "chip" ? "8px 12px" : 16,
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                  }}
                >
                  <Typography.Text strong>
                    HOVER_LIFT.{label} = {HOVER_LIFT[key]}px
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>
                    {hint}
                  </Typography.Text>
                </motion.div>
              </Col>
            ))}
          </Row>
        </Col>

        <Col xs={24} md={12}>
          <DemoLabel>Indicador con layoutId (como el menú y ChoiceCards)</DemoLabel>
          <Flex gap={4} role="tablist" aria-label="Período" style={{ padding: 4, borderRadius: token.borderRadiusLG, background: token.colorFillTertiary, width: "fit-content" }}>
            {["día", "semana", "mes"].map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                onClick={() => setTab(option)}
                className="od-focusable"
                style={{ position: "relative", padding: "6px 14px", border: "none", background: "none", font: "inherit", cursor: "pointer", color: tab === option ? token.colorPrimary : token.colorTextSecondary, borderRadius: token.borderRadius }}
              >
                {tab === option && (
                  <motion.span
                    layoutId="design-motion-indicator"
                    transition={SPRING.snappy}
                    style={{ position: "absolute", inset: 0, borderRadius: token.borderRadius, background: token.colorBgContainer, boxShadow: token.boxShadowTertiary }}
                  />
                )}
                <span style={{ position: "relative" }}>{option}</span>
              </button>
            ))}
          </Flex>
        </Col>
        <Col xs={24} md={6}>
          <DemoLabel>AnimatedNumber</DemoLabel>
          <Flex align="center" gap={12}>
            <Typography.Text style={{ fontSize: token.fontSizeHeading2, fontWeight: 600 }}>
              <AnimatedNumber value={count} />
            </Typography.Text>
            <Button icon={<Shuffle />} aria-label="Número al azar" onClick={() => setCount(Math.round(Math.random() * 2000))} />
          </Flex>
        </Col>
        <Col xs={24} md={6}>
          <DemoLabel>HouseMark</DemoLabel>
          <Flex gap={24} align="center">
            <HouseMark size={40} />
            <HouseMark size={40} loading />
          </Flex>
        </Col>
      </Row>
    </DemoBlock>
  );
}
