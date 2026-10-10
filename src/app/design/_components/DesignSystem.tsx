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
import { PrimitivesSection } from "./PrimitivesSection";
import { RecipesFlow } from "./RecipesFlow";
import { ReviewSection } from "./ReviewSection";
import { SecuritySection } from "./SecuritySection";
import { SignatureSection } from "./SignatureSection";
import { SkinsSection } from "./SkinsSection";
import { StorageFlow } from "./StorageFlow";
import { VoiceSection } from "./VoiceSection";
import { EntryFlow, EntrySection } from "./EntrySection";
import { CatalogSection } from "./CatalogSection";

// El orden de cada grupo es el orden en la página (el índice sigue el scroll).
const TOC = [
  {
    group: "Fundamentos",
    items: [["principios", "Principios"], ["tokens", "Tokens"], ["tipografia", "Tipografía e íconos"], ["firma", "Firma visual"], ["skins", "Skins"], ["movimiento", "Movimiento"], ["voz", "Voz y textos"]],
  },
  { group: "Componentes antd", items: [["botones", "Botones"], ["feedback", "Feedback"], ["formularios", "Formularios"], ["tablas", "Tablas"]] },
  {
    group: "Componentes propios",
    items: [["componentes-estructura", "Estructura"], ["componentes-estados", "Estados"], ["componentes-seleccion", "Selección"], ["componentes-datos", "Datos"], ["componentes-espacios", "Espacios"], ["componentes-entrada", "Entrada"]],
  },
  { group: "Flujos", items: [["flujo-almacenamiento", "Almacenamiento"], ["flujo-catalogo", "Catálogo"], ["flujo-recetas", "Recetas"], ["flujo-entrada", "Entrada"]] },
  { group: "Calidad", items: [["revision", "Revisión antes de un PR"]] },
  { group: "Seguridad", items: [["permisos", "Matriz de permisos"], ["can", "<Can>"], ["servicios", "Servicios"]] },
] as const;

export function DesignSystem() {
  return (
    <RequirePermission perform="settings.design">
      <PageHeader
        eyebrow="El estándar"
        title="Sistema de diseño"
        description="Cómo se ve, se mueve y habla Refugiar. Todo lo que se ve acá usa el código real: si cambia acá, cambia en la app. Si una pieza no está en esta página, se agrega acá antes de usarla en una pantalla."
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
            <SignatureSection />
            <SkinsSection />
            <MotionSection />
            <VoiceSection />
          </Section>
          <Section title="Componentes antd">
            <ActionsSection />
            <FormsSection />
            <DataSection />
          </Section>
          <Section title="Componentes propios">
            <PrimitivesSection />
            <EntrySection />
          </Section>
          <Section title="Flujos">
            <StorageFlow />
            <CatalogSection />
            <RecipesFlow />
            <EntryFlow />
          </Section>
          <Section title="Calidad">
            <ReviewSection />
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
