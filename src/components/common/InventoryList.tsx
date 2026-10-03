"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, Button, Typography, Popconfirm } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  inventoryType: 'alacena' | 'taller';
  title: string;
}

const { Text } = Typography;

export function InventoryList({ inventoryType, title }: Props) {
  const { currentUser } = useAppStore();
  const items = useLiveQuery(() => 
    db.inventory.where('inventoryType').equals(inventoryType).toArray()
  );

  const updateQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    await db.inventory.update(id, { quantity: newQuantity, updatedAt: Date.now() });
  };

  const deleteItem = async (id: string) => {
    // Seguridad: Prevenir borrado malicioso
    if (currentUser?.role === 'kid') return; 
    await db.inventory.delete(id);
  };

  const isKid = currentUser?.role === 'kid';

  return (
    <Card title={title} styles={{ body: { padding: 0 } }} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items?.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>El inventario está vacío.</div>
        )}
        <AnimatePresence>
          {items?.map((item) => (
            <motion.div
              key={item.id}
              layout // Aceleración por GPU automática (transform: translate3d)
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fff'
              }}
            >
              <div>
                <Text strong style={{ fontSize: isKid ? 24 : 16 }}>{item.name}</Text>
                {!isKid && <div style={{ fontSize: 12, color: '#888' }}>Mínimo ideal: {item.minThreshold} {item.unit}</div>}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: 8, padding: 4 }}>
                  {!isKid && (
                    <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 0} />
                  )}
                  <div style={{ width: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: isKid ? 24 : 16 }}>{item.quantity}</Text>
                    <Text style={{ fontSize: 10, textTransform: 'uppercase', color: '#888' }}>{item.unit}</Text>
                  </div>
                  {!isKid && (
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => updateQuantity(item.id, item.quantity + 1)} />
                  )}
                </div>
                
                {!isKid && (
                  <Popconfirm title="¿Eliminar producto?" onConfirm={() => deleteItem(item.id)}>
                    <Button danger type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
