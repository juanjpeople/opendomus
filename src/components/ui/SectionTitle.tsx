"use client";

import { Typography, theme } from "antd";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";

/** Título editorial de la portada. Para secciones dentro de la app, SectionHeader. */
export function SectionTitle({ id, eyebrow, title, description }: {
  id?: string; eyebrow: string; title: ReactNode; description: ReactNode;
}) {
  const { token } = theme.useToken();
  return <Reveal inView style={{ maxWidth: token.controlHeight * 22, marginBottom: token.marginXL }}>
    <Typography.Text strong style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}>{eyebrow}</Typography.Text>
    <Typography.Title id={id} level={2} style={{ marginBlock: `${token.marginXS}px ${token.marginSM}px`, fontSize: `clamp(${token.fontSizeHeading3}px, 4vw, ${token.fontSizeHeading1}px)`, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>{title}</Typography.Title>
    <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeLG, margin: 0 }}>{description}</Typography.Paragraph>
  </Reveal>;
}
