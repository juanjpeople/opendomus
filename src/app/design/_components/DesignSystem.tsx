"use client";

import { Anchor, Col, Flex, Row, Typography } from "antd";
import type { ReactNode } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui";
import { ActionsSection } from "./ActionsSection";
import { DataSection } from "./DataSection";
import { FormsSection } from "./FormsSection";
import { FoundationsSection } from "./FoundationsSection";
import { MotionSection } from "./MotionSection";
import { SecuritySection } from "./SecuritySection";

const TOC = [
  { group: "Fundamentos", items: [["principios", "Principios"], ["tokens", "Tokens"], ["tipografia", "Tipografía e íconos"], ["movimiento", "Movimiento"]] },
  { group: "Componentes", items: [["botones", "Botones"], ["feedback", "Feedback"], ["formularios", "Formularios"], ["tablas", "Tablas"], ["componentes", "Componentes propios"]] },
  { group: "Seguridad", items: [["permisos", "Matriz de permisos"], ["can", "<Can>"], ["servicios", "Servicios"]] },
] as const;

export function DesignSystem() {
  return (
    <RequirePermission perform="settings.design">
      <PageHeader
        title="Sistema de diseño"
        description="La referencia del proyecto: principios, tokens, componentes y seguridad. Todo lo que se ve acá usa el código real, así que si cambia acá, cambia en la app."
      />
      <Row gutter={32}>
        <Col xs={0} lg={5}>
          <Anchor
            offsetTop={24}
            items={TOC.map(({ group, items }) => ({
              key: group,
              href: `#${items[0][0]}`,
              title: <Typography.Text strong>{group}</Typography.Text>,
              children: items.map(([id, title]) => ({ key: id, href: `#${id}`, title })),
            }))}
          />
        </Col>
        <Col xs={24} lg={19}>
          <Section title="Fundamentos">
            <FoundationsSection />
            <MotionSection />
          </Section>
          <Section title="Componentes">
            <ActionsSection />
            <FormsSection />
            <DataSection />
          </Section>
          <Section title="Seguridad y permisos">
            <SecuritySection />
          </Section>
        </Col>
      </Row>
    </RequirePermission>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Flex vertical gap={24}>
        {children}
      </Flex>
    </section>
  );
}
