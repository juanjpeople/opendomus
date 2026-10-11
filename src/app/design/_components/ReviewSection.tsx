"use client";

import { Checkbox, Flex, Progress, Typography, theme } from "antd";
import { useState } from "react";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const CHECKS = [
  {
    group: "Sistema",
    items: [
      "Cada pieza visual sale de @/components/ui o de antd. Si no está en esta página, se agrega acá primero.",
      "Colores, radios y tamaños desde theme.useToken(). Nada de hex, ni px de radio, ni tamaños de letra sueltos.",
      "Íconos lucide sin size: crecen con el font-size del contenedor.",
      "Un solo PageHeader. Las secciones abren con SectionHeader o con el title de su Card, pero no los dos estilos en la misma página.",
      "Como mucho una acción primaria visible y dos acciones en la cabecera; el resto, en un Dropdown con ⋯.",
    ],
  },
  {
    group: "Movimiento",
    items: [
      "La página entra en cascada: Reveal / Stagger con delays de 0.05 a 0.25.",
      "Lo que se toca responde: HOVER_LIFT + TAP con SPRING.snappy. Listas con AnimatePresence (entran y salen).",
      "Los cambios de paso o de estado tienen transición (AnimatePresence mode=\"wait\"), no saltos.",
      "Solo transform y opacity. Nada de animar top, left, width o height.",
      "Con Ajustes → Movimiento: reducidas, nada se mueve.",
    ],
  },
  {
    group: "Textos",
    items: [
      "Todo por t(). Nada de locale === \"es\" ? … : … en un componente.",
      "Voseo, una idea por oración, plurales con { one, other }.",
      "Sin jerga técnica en la pantalla principal.",
      "Cada opción explica qué implica (qué crea, qué carga, un ejemplo) y si se puede cambiar después.",
    ],
  },
  {
    group: "Probado",
    items: [
      "Claro y oscuro. Color de marca distinto al azul (cambialo en Tokens).",
      "Redondeo en 0 y en 20. Letra en extra grande.",
      "Celular de 320px: sin scroll horizontal; botones táctiles de 44px.",
      "Teclado: todo se alcanza con Tab y el foco se ve. Botones de solo ícono con aria-label.",
      "Las pruebas e2e siguen encontrando los botones por su nombre.",
    ],
  },
] as const;

/** La lista que se repasa antes de abrir un PR que toque la UI. */
export function ReviewSection() {
  const { token } = theme.useToken();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = CHECKS.reduce((sum, { items }) => sum + items.length, 0);

  return (
    <DemoBlock
      id="revision"
      title="Revisión antes de un PR"
      description="La misma lista para personas y agentes. Si algo no se cumple, se arregla o se discute acá, no se deja pasar. Las tildes no se guardan: es para repasar."
    >
      <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
        <Progress percent={Math.round((checked.size / total) * 100)} size="small" style={{ flex: 1, margin: 0 }} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: "nowrap" }}>
          {checked.size} de {total}
        </Typography.Text>
      </Flex>
      <Flex vertical gap={20}>
        {CHECKS.map(({ group, items }) => (
          <div key={group}>
            <DemoLabel>{group}</DemoLabel>
            <Flex vertical gap={8}>
              {items.map((text) => (
                <Checkbox
                  key={text}
                  checked={checked.has(text)}
                  onChange={(event) =>
                    setChecked((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(text);
                      else next.delete(text);
                      return next;
                    })
                  }
                >
                  {text}
                </Checkbox>
              ))}
            </Flex>
          </div>
        ))}
      </Flex>
    </DemoBlock>
  );
}
