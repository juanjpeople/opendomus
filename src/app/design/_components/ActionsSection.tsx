"use client";

import { Alert, App, Button, Col, Empty, Flex, Row, Skeleton, Space } from "antd";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import { DemoBlock, DemoLabel } from "./DemoBlock";

export function ActionsSection() {
  return (
    <>
      <DemoBlock
        id="botones"
        title="Botones"
        description="Una sola acción primaria por vista. Acciones destructivas con danger y siempre con confirmación. Los botones de solo ícono llevan aria-label."
        code={`
<Button type="primary" icon={<Plus />}>Agregar</Button>
<Button danger icon={<Trash2 />}>Eliminar</Button>
<Button type="text" aria-label="Buscar" icon={<Search />} />
`}
      >
        <Flex vertical gap={20}>
          <div>
            <DemoLabel>Jerarquía</DemoLabel>
            <Space wrap>
              <Button type="primary" icon={<Plus />}>
                Primaria
              </Button>
              <Button>Default</Button>
              <Button type="dashed">Dashed</Button>
              <Button type="text">Text</Button>
              <Button type="link">Link</Button>
            </Space>
          </div>
          <div>
            <DemoLabel>Peligro</DemoLabel>
            <Space wrap>
              <Button type="primary" danger icon={<Trash2 />}>
                Eliminar
              </Button>
              <Button danger>Danger default</Button>
              <Button danger type="text" aria-label="Eliminar" icon={<Trash2 />} />
            </Space>
          </div>
          <div>
            <DemoLabel>Estados y formas</DemoLabel>
            <Space wrap>
              <Button type="primary" loading>
                Guardando
              </Button>
              <Button disabled>Deshabilitado</Button>
              <Button type="primary" shape="circle" aria-label="Buscar" icon={<Search />} />
              <Button shape="round" icon={<Download />}>
                Descargar
              </Button>
              <Button size="small">Small</Button>
              <Button size="large">Large</Button>
            </Space>
          </div>
        </Flex>
      </DemoBlock>

      <FeedbackBlock />
    </>
  );
}

function FeedbackBlock() {
  // Siempre vía App.useApp(): respeta tema y locale (los métodos estáticos message.success() no).
  const { message, notification, modal } = App.useApp();

  return (
    <DemoBlock
      id="feedback"
      title="Feedback"
      description="message para confirmaciones breves, notification para eventos del sistema, modal.confirm para decisiones. Estados de carga con Skeleton y vacíos con Empty."
      code={`
import { App } from "antd";

const { message, modal } = App.useApp();

message.success("Ítem agregado");
modal.confirm({ title: "¿Eliminar?", okButtonProps: { danger: true }, onOk: () => remove(id) });
`}
    >
      <DemoLabel>Mensajes</DemoLabel>
      <Space wrap style={{ marginBottom: 20 }}>
        <Button onClick={() => message.success("Ítem agregado")}>message.success</Button>
        <Button onClick={() => message.error("No tenés permiso para: eliminar ítems.")}>message.error</Button>
        <Button
          onClick={() =>
            notification.warning({ title: "Stock bajo", description: "Quedan 2 paquetes de arroz (mínimo: 3)." })
          }
        >
          notification
        </Button>
        <Button
          danger
          onClick={() =>
            modal.confirm({
              title: "¿Eliminar este ítem?",
              content: "Esta acción no se puede deshacer.",
              okText: "Eliminar",
              okButtonProps: { danger: true },
              cancelText: "Cancelar",
            })
          }
        >
          modal.confirm
        </Button>
      </Space>

      <DemoLabel>Alertas</DemoLabel>
      <Flex vertical gap={8} style={{ marginBottom: 20 }}>
        <Alert type="info" showIcon title="Información" description="Sincronización disponible en una próxima versión." />
        <Alert type="success" showIcon title="Todo en orden" />
        <Alert type="warning" showIcon title="3 ítems con stock bajo" />
        <Alert type="error" showIcon title="No se pudo guardar" />
      </Flex>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <DemoLabel>Cargando</DemoLabel>
          <Skeleton active paragraph={{ rows: 2 }} />
        </Col>
        <Col xs={24} md={12}>
          <DemoLabel>Vacío</DemoLabel>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay productos." />
        </Col>
      </Row>
    </DemoBlock>
  );
}
