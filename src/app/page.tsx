"use client";

import { Card, Typography, Row, Col, Statistic } from "antd";
import { InboxOutlined, ToolOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";

const { Title, Paragraph } = Typography;

export default function Home() {
  const alacenaCount = useLiveQuery(() => db.inventory.where('inventoryType').equals('alacena').count());
  const tallerCount = useLiveQuery(() => db.inventory.where('inventoryType').equals('taller').count());

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}>Bienvenido a OpenDomus 🏠</Title>
      <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 32 }}>
        El sistema operativo de tu casa, completamente offline-first.
      </Paragraph>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={8}>
          <Link href="/alacena">
            <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: 24, textAlign: 'center' } }}>
              <InboxOutlined style={{ fontSize: 36, color: '#1677ff', marginBottom: 16 }} />
              <Statistic title="Alacena" value={alacenaCount ?? 0} suffix="productos" />
            </Card>
          </Link>
        </Col>
        
        <Col xs={24} sm={12} md={8}>
          <Link href="/taller">
            <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: 24, textAlign: 'center' } }}>
              <ToolOutlined style={{ fontSize: 36, color: '#fa8c16', marginBottom: 16 }} />
              <Statistic title="Taller" value={tallerCount ?? 0} suffix="herramientas" />
            </Card>
          </Link>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Link href="/compras">
            <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: 24, textAlign: 'center' } }}>
              <ShoppingCartOutlined style={{ fontSize: 36, color: '#52c41a', marginBottom: 16 }} />
              <Statistic title="Lista de Compras" value={"En desarrollo"} />
            </Card>
          </Link>
        </Col>
      </Row>
    </div>
  );
}
