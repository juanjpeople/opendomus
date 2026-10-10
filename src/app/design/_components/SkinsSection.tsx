"use client";

import { Col, Row, Table, Typography, theme } from "antd";
import { SkinLivePreview, SkinPreview } from "@/features/settings/components/Previews";
import { useI18n } from "@/i18n";
import { SKINS } from "@/skins/skins";
import { SKIN_IDS } from "@/skins/types";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const CONTROLS = [
  { piece: "Colores de superficie y bordes", how: "Tokens de antd (`createTheme`): no se escriben colores en las pantallas." },
  { piece: "Color de marca y redondeo", how: "Al elegir un skin se aplican; la persona los puede ajustar después." },
  { piece: "Sombras", how: "Tokens `boxShadow*` según la elevación: suave, plana o solo con borde." },
  { piece: "Tarjetas tintadas y halo de fondo", how: "`surfaceBackground()` y `haloBackground()`: el skin decide si llevan degradado." },
  { piece: "Pisos del plano", how: "`RoomFloor` pinta su textura solo si el skin la usa." },
  { piece: "Tipografía de los títulos", how: "Variable `--od-font-heading`, puesta por el tema; las fuentes se autoalojan." },
  { piece: "Ilustraciones de la casa", how: "`House` y `HouseMark` toman grosor y esquinas del skin." },
];

/** Skins: el estilo completo de la app, elegible en Ajustes. Los datos viven en `src/skins`. */
export function SkinsSection() {
  const { token } = theme.useToken();
  const { t } = useI18n();

  return (
    <DemoBlock
      id="skins"
      title="Skins"
      description="Un skin es un conjunto de datos (src/skins/skins.ts) que cada persona elige en Ajustes. 'Casa' es el aspecto original y no cambia nada; los demás varían superficies, sombras, tipografía e ilustraciones sin tocar las pantallas. En una pantalla se lee con useSkin(): nunca se escribe un estilo por skin."
      code={`const skin = useSkin();
background: surfaceBackground(skin, palette.bg, token.colorBgContainer, 60)
background: haloBackground(skin, \`radial-gradient(...)\`, token.colorBgLayout)

// Ajustes: vista previa en vivo del skin bajo el mouse o con el foco.
<ChoiceCards onPreview={setPreviewing} ... />
<SkinLivePreview skin={SKINS[previewing ?? preferences.skin]} />`}
    >
      <DemoLabel>Los skins, con el tema actual</DemoLabel>
      <Row gutter={[token.marginSM, token.marginSM]} style={{ marginBottom: token.marginLG }}>
        {SKIN_IDS.map((id) => (
          <Col key={id} xs={24} sm={8}>
            <div style={{ borderRadius: token.borderRadiusLG, overflow: "hidden", border: `${token.lineWidth}px solid ${token.colorBorderSecondary}` }}>
              <SkinPreview skin={SKINS[id]} />
            </div>
            <Typography.Text strong style={{ display: "block", marginTop: token.marginXS }}>
              {t(`settings.appearance.skins.${id}.title`)}
            </Typography.Text>
            <Typography.Text type="secondary">{t(`settings.appearance.skins.${id}.text`)}</Typography.Text>
          </Col>
        ))}
      </Row>
      <DemoLabel>Vista previa en vivo (Ajustes): piezas reales con el tema del skin, antes de elegirlo</DemoLabel>
      <Row gutter={[token.marginSM, token.marginSM]} style={{ marginBottom: token.marginLG }}>
        {SKIN_IDS.map((id) => (
          <Col key={id} xs={24} md={12} xl={8}>
            <SkinLivePreview skin={SKINS[id]} />
          </Col>
        ))}
      </Row>
      <DemoLabel>Qué controla un skin</DemoLabel>
      <Table
        size="small"
        pagination={false}
        rowKey="piece"
        dataSource={CONTROLS}
        columns={[
          { title: "Pieza", dataIndex: "piece" },
          { title: "Cómo", dataIndex: "how" },
        ]}
      />
    </DemoBlock>
  );
}
