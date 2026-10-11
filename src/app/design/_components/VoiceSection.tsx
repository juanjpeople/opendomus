"use client";

import { Col, Flex, Row, Typography, theme } from "antd";
import { Check, X } from "lucide-react";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const RULES = [
  ["Voseo y segunda persona", "Cargá, elegí, anotá. Le hablamos a una persona de la casa, no a un usuario."],
  ["Una idea por oración", "Corto y cálido. Si hace falta explicar más, va en una ayuda (Tooltip, Callout), no en el título."],
  ["Preguntas que invitan", "Para títulos y placeholders que abren una acción: ¿Qué hay que comprar? ¿Dónde guardé…?"],
  ["Metáforas de casa, sin venta", "Cada cosa en su lugar. La casa se va amueblando. Honesto: nada de 'increíble' ni promesas."],
  ["Mayúscula solo al principio", "Lista de compras, no Lista De Compras. Sin signos de exclamación salvo para celebrar algo."],
  ["Plurales siempre", "{ one, other } en el diccionario. Nunca '1 anotaciones'; si es cero y no importa, no se dice."],
  ["Cada opción dice qué implica", "Antes de elegir, la persona sabe qué crea, qué carga o qué cambia, con un ejemplo concreto. Si se puede deshacer, se dice dónde."],
  ["Errores que ayudan", "Qué pasó y qué hacer, en el mismo tono: 'Ingresá un nombre.' La misma frase para el mismo error en toda la app."],
  ["Sin jerga técnica a la vista", "HTTPS, WebXR, IA, cifrado de extremo a extremo: en la ayuda o en Privacidad, no en el texto principal."],
] as const;

const EXAMPLES = [
  { no: "Inventario registrado; no detección del contenido", yes: "Lo que anotaste que hay adentro. La cámara no mira el contenido." },
  { no: "Activar escuela: materias, mochila y tareas", yes: "Usar la agenda escolar. Con las materias cargadas, Inicio te muestra cada día qué clases hay y qué llevar." },
  { no: "Compra completa · principio de mes (sin más)", yes: "Compra completa. Carga 9 artículos, por ejemplo Leche (3 litros)." },
  { no: "1 anotaciones · 0 fotos", yes: "1 anotación" },
  { no: "El nombre es obligatorio. / Ingresá un nombre (según la pantalla)", yes: "Ingresá un nombre. (siempre la misma)" },
  { no: "No envía imágenes ni usa IA.", yes: "Todo pasa en este teléfono: las imágenes no salen de acá." },
  { no: "Requiere HTTPS en Chrome para Android con controles en AR.", yes: "La vista AR anda en Chrome para Android. Acá podés usar la cámara común." },
  { no: "Cámara y AR · AR espacial · Mirar y encontrar (tres nombres)", yes: "Cámara, con modos: Escanear QR · Mirar y encontrar · AR" },
] as const;

/** Cómo habla Refugiar. La voz es parte de la identidad tanto como el color. */
export function VoiceSection() {
  const { token } = theme.useToken();

  return (
    <DemoBlock
      id="voz"
      title="Voz y textos"
      description="Cómo habla Refugiar. Un texto largo o frío se nota tanto como un color fuera de lugar. Ningún texto se escribe en el componente: todo pasa por t() (esta página es la única excepción, porque es documentación interna)."
      code={`
// i18n/messages/es.ts es la fuente; en.ts está tipado contra ella (falta una clave = no compila).
// Claves: módulo → parte de la pantalla → elemento.
storage: {
  search: { placeholder: "¿Dónde guardé…?" },
  contents: { count: { one: "{count} anotación", other: "{count} anotaciones" } },
},

const t = useT();
t("storage.contents.count", { count: notes.length });
`}
    >
      <Flex vertical gap={12} style={{ marginBottom: 24 }}>
        {RULES.map(([title, text]) => (
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

      <DemoLabel>Así no / así sí (textos reales encontrados en la auditoría)</DemoLabel>
      <Flex vertical gap={8}>
        {EXAMPLES.map(({ no, yes }) => (
          <Row key={no} gutter={[8, 8]}>
            <Col xs={24} md={12}>
              <Flex gap={8} align="baseline" style={{ height: "100%", padding: "10px 12px", borderRadius: token.borderRadiusLG, background: token.colorErrorBg }}>
                <Typography.Text type="danger">
                  <X />
                </Typography.Text>
                <Typography.Text>{no}</Typography.Text>
              </Flex>
            </Col>
            <Col xs={24} md={12}>
              <Flex gap={8} align="baseline" style={{ height: "100%", padding: "10px 12px", borderRadius: token.borderRadiusLG, background: token.colorSuccessBg }}>
                <Typography.Text type="success">
                  <Check />
                </Typography.Text>
                <Typography.Text>{yes}</Typography.Text>
              </Flex>
            </Col>
          </Row>
        ))}
      </Flex>
    </DemoBlock>
  );
}
