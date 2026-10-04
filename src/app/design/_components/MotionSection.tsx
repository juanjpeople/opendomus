"use client";

import { Button, Col, Flex, Row, Typography, theme } from "antd";
import { RotateCcw, Shuffle } from "lucide-react";
import { useState } from "react";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { DemoBlock, DemoLabel } from "./DemoBlock";

export function MotionSection() {
  const { token } = theme.useToken();
  const [replay, setReplay] = useState(0);
  const [count, setCount] = useState(42);

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
      description="La app se siente viva pero nunca hace esperar: animaciones cortas, solo transform y opacity, y todo respeta 'reducir movimiento' del sistema (MotionConfig en ThemeProvider). Tiempos y curvas salen de lib/motion.ts."
      code={`
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SPRING } from "@/lib/motion";

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
<motion.div whileHover={{ y: -4 }} transition={SPRING.snappy} />
`}
    >
      <Flex justify="flex-end" style={{ marginBottom: 16 }}>
        <Button icon={<RotateCcw />} onClick={() => setReplay((n) => n + 1)}>
          Repetir animaciones
        </Button>
      </Flex>
      <Row gutter={[24, 24]} key={replay}>
        <Col xs={24} md={8}>
          <DemoLabel>Reveal</DemoLabel>
          <Reveal>
            <div style={box}>Hola 👋</div>
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
        <Col xs={24} md={8}>
          <DemoLabel>AnimatedNumber</DemoLabel>
          <Flex align="center" gap={12}>
            <Typography.Text style={{ fontSize: 32, fontWeight: 600 }}>
              <AnimatedNumber value={count} />
            </Typography.Text>
            <Button icon={<Shuffle />} aria-label="Número al azar" onClick={() => setCount(Math.round(Math.random() * 2000))} />
          </Flex>
        </Col>
        <Col xs={24} md={16}>
          <DemoLabel>HouseMark (logo y estado de carga)</DemoLabel>
          <Flex gap={24} align="center">
            <HouseMark size={40} />
            <HouseMark size={40} loading />
          </Flex>
        </Col>
      </Row>
    </DemoBlock>
  );
}
