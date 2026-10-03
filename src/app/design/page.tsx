"use client";

import { Card, Typography, ColorPicker, Slider, Space, Divider, Button, Alert, Row, Col, Segmented, Table, Tag, Form, Input } from "antd";
import { useAppStore } from "@/store/useAppStore";
import { FormatPainterOutlined, SearchOutlined, DownloadOutlined, LockOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Protected } from "@/components/common/Protected";

const { Title, Text, Paragraph } = Typography;

export default function DesignSystemPage() {
  const { brandColor, setBrandColor, borderRadius, setBorderRadius, currentUser } = useAppStore();

  const tableData = [
    { key: '1', name: 'Taladro percutor', category: 'Herramientas', stock: 1, status: 'ok' },
    { key: '2', name: 'Arroz (Bolsa 1kg)', category: 'Alimentos', stock: 0, status: 'empty' },
    { key: '3', name: 'Pintura Blanca', category: 'Materiales', stock: 2, status: 'low' },
  ];

  const tableColumns = [
    { title: 'Ítem', dataIndex: 'name', key: 'name', render: (text: string) => <Text strong>{text}</Text> },
    { title: 'Categoría', dataIndex: 'category', key: 'category' },
    { 
      title: 'Estado', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        let color = 'green';
        let label = 'En stock';
        if (status === 'empty') { color = 'red'; label = 'Agotado'; }
        if (status === 'low') { color = 'orange'; label = 'Bajo'; }
        return <Tag color={color}>{label}</Tag>;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: () => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} />
          <Protected allowedRoles={['admin', 'adult']} fallback="disable" tooltipMessage="Solo los adultos pueden borrar ítems">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Protected>
        </Space>
      )
    }
  ];

  return (
    <div style={{ paddingBottom: 64 }}>
      <Title level={2}>🎨 Sistema Base & Documentación</Title>
      <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 32 }}>
        Esta página sirve como la **verdad absoluta** del proyecto. Todos los componentes, estándares de seguridad y layouts deben probarse aquí antes de llevarse a las páginas reales.
      </Paragraph>

      <Row gutter={[24, 24]}>
        
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            
            <Card title={<><FormatPainterOutlined /> Tokens Globales</>} style={{ borderRadius }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
                <div>
                  <div style={{ marginBottom: 8 }}><Text strong>Color Principal</Text></div>
                  <Space wrap>
                    <ColorPicker value={brandColor} onChange={(c) => setBrandColor(c.toHexString())} showText />
                    <Button onClick={() => setBrandColor('#1677ff')}>Reset</Button>
                  </Space>
                </div>
                <div>
                  <div style={{ marginBottom: 8 }}><Text strong>Redondeo de Componentes (px)</Text></div>
                  <Slider min={0} max={24} value={borderRadius} onChange={setBorderRadius} marks={{ 0: '0', 8: '8', 24: '24' }} />
                </div>
              </div>
            </Card>

            <Card title={<><LockOutlined /> Pruebas de Seguridad (RBAC)</>} style={{ borderRadius }}>
              <Paragraph>Tu rol actual es: <Tag color="blue">{currentUser?.role}</Tag></Paragraph>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                Cambiá tu rol usando el selector de arriba a la derecha para ver cómo reaccionan los siguientes componentes.
              </Paragraph>
              
              <Divider />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                <div>
                  <div style={{ marginBottom: 8 }}><Text strong>1. Componente "Hide" (Admin solo)</Text></div>
                  <Protected allowedRoles={['admin']} fallback="hide">
                    <Alert title="Información Confidencial" description="Este cartel desaparece del DOM si no sos Admin." type="error" showIcon />
                  </Protected>
                </div>
                
                <Divider dashed style={{ margin: '8px 0' }} />

                <div>
                  <div style={{ marginBottom: 8 }}><Text strong>2. Componente "Disable" (Admin/Adultos)</Text></div>
                  <Protected allowedRoles={['admin', 'adult']} fallback="disable" tooltipMessage="Necesitás ser adulto para hacer esto">
                    <Button type="primary" danger>Pagar Facturas (Botón Restringido)</Button>
                  </Protected>
                </div>
              </div>
            </Card>

          </div>
        </Col>

        <Col xs={24} lg={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            
            <Card title="Tablas y Grillas Estandarizadas" style={{ borderRadius }}>
              <Paragraph>Este es el estándar para mostrar listados de datos. Incluye Tags, botones de acción Icon-only y el componente de Seguridad protegiendo el botón de borrado.</Paragraph>
              <Table 
                columns={tableColumns} 
                dataSource={tableData} 
                pagination={false}
                size="middle"
              />
            </Card>

            <Card title="Botones (Sizes, Variants & States)" style={{ borderRadius }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
                
                <div>
                  <div style={{ marginBottom: 12 }}><Text type="secondary">Tipos Clásicos</Text></div>
                  <Space wrap size="middle">
                    <Button type="primary">Primary</Button>
                    <Button>Default</Button>
                    <Button type="dashed">Dashed</Button>
                    <Button type="text">Text</Button>
                    <Button type="link">Link</Button>
                  </Space>
                </div>

                <div>
                  <div style={{ marginBottom: 12 }}><Text type="secondary">Colores (Danger & Warning)</Text></div>
                  <Space wrap size="middle">
                    <Button type="primary" danger>Danger Primary</Button>
                    <Button danger>Danger Default</Button>
                    <Button danger type="dashed">Danger Dashed</Button>
                    <Button danger type="text">Danger Text</Button>
                  </Space>
                </div>

                <div>
                  <div style={{ marginBottom: 12 }}><Text type="secondary">Estados y Formas</Text></div>
                  <Space wrap size="middle">
                    <Button type="primary" loading>Loading...</Button>
                    <Button type="primary" icon={<DownloadOutlined />} />
                    <Button type="primary" shape="circle" icon={<SearchOutlined />} />
                    <Button type="primary" shape="round" icon={<DownloadOutlined />}>Download</Button>
                    <Button disabled>Disabled</Button>
                  </Space>
                </div>
              </div>
            </Card>

            <Card title="Formularios Estandarizados" style={{ borderRadius }}>
              <Form layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Nombre del Ítem" required>
                      <Input placeholder="Escriba aquí..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Categoría">
                      <Segmented block options={['Alacena', 'Taller', 'Bóveda']} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item>
                  <Button type="primary">Guardar Cambios</Button>
                </Form.Item>
              </Form>
            </Card>

          </div>
        </Col>

      </Row>
    </div>
  );
}
