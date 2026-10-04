"use client";

import { Flex, Typography } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { IconTile } from "./IconTile";

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Acción sugerida (botón o link). */
  action?: ReactNode;
}

/** Estado vacío o "todavía no": ícono que flota suave + mensaje + acción. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Reveal>
      <Flex vertical align="center" gap={12} style={{ padding: "48px 24px", textAlign: "center" }}>
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
          <IconTile icon={icon} size={64} />
        </motion.div>
        <Typography.Title level={4} style={{ margin: "8px 0 0" }}>
          {title}
        </Typography.Title>
        {description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0, maxWidth: 420 }}>
            {description}
          </Typography.Paragraph>
        )}
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </Flex>
    </Reveal>
  );
}
