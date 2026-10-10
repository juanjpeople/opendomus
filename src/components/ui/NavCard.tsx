"use client";

import { Card, Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { IconTile } from "./IconTile";

interface NavCardProps {
  href: string;
  icon: LucideIcon;
  color?: AppearanceColor;
  /** Nombre de lo que se abre (en secundario, arriba). */
  title: ReactNode;
  /** El dato que importa: una cifra grande, un estado. */
  children: ReactNode;
}

/**
 * La tarjeta firma de Refugio: lleva a otra página. Al pasar el mouse sube, el ícono gira
 * y crece apenas, y aparece una flecha. En grillas, envolverla en `StaggerItem`.
 */
export function NavCard({ href, icon, color, title, children }: NavCardProps) {
  const { token } = theme.useToken();

  return (
    <Link href={href} style={{ display: "block", height: "100%" }}>
      <motion.div whileHover="hover" whileTap={{ scale: TAP.card }} initial="rest" animate="rest" style={{ height: "100%" }}>
        <motion.div variants={{ rest: { y: 0 }, hover: { y: HOVER_LIFT.card } }} transition={SPRING.snappy} style={{ height: "100%" }}>
          <Card hoverable style={{ height: "100%" }}>
            <Flex gap={16} align="flex-start">
              <motion.div variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -6, scale: 1.08 } }} transition={SPRING.snappy}>
                <IconTile icon={icon} color={color} />
              </motion.div>
              <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                <Typography.Text type="secondary">{title}</Typography.Text>
                {children}
              </Flex>
              <motion.span
                variants={{ rest: { x: -6, opacity: 0 }, hover: { x: 0, opacity: 1 } }}
                transition={SPRING.snappy}
                style={{ display: "inline-flex", fontSize: token.fontSizeXL, alignSelf: "center", color: token.colorTextTertiary }}
              >
                <ArrowRight />
              </motion.span>
            </Flex>
          </Card>
        </motion.div>
      </motion.div>
    </Link>
  );
}
