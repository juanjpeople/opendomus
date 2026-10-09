"use client";

import { Alert, Button, Flex, Form, Grid, Input, Modal, Segmented, Typography, theme } from "antd";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { LABEL_SIZES, containerQrUrl, isLocalhostUrl, useLabelSettings, type LabelSize } from "../labels";
import { ContainerLabel, type LabelData } from "./ContainerLabel";

interface LabelModalProps {
  labels: LabelData[];
  open: boolean;
  onClose: () => void;
}

/** Elegir tamaño y dirección, ver la vista previa e imprimir (solo las etiquetas, sin la app). */
export function LabelModal({ labels, open, onClose }: LabelModalProps) {
  const t = useT();
  const { token } = theme.useToken();
  const { baseUrl, size, setBaseUrl, setSize } = useLabelSettings();
  const screens = Grid.useBreakpoint();
  const [printing, setPrinting] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const effectiveBase = baseUrl || origin;

  // Al montarse el área de impresión, se abre el diálogo del navegador; al cerrarlo, se desmonta.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const { width } = LABEL_SIZES[size];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={t("labels.title", { count: labels.length })}
        width={560}
        footer={
          <Button type="primary" icon={<Printer />} onClick={() => setPrinting(true)} disabled={labels.length === 0}>
            {t("labels.print")}
          </Button>
        }
      >
        <Form layout="vertical">
          <Form.Item label={t("labels.size")}>
            <Segmented<LabelSize>
              vertical={!screens.sm}
              block={!screens.sm}
              value={size}
              onChange={setSize}
              options={(Object.keys(LABEL_SIZES) as LabelSize[]).map((value) => ({ value, label: t(`labels.sizes.${value}`) }))}
            />
          </Form.Item>
          {size === "shelf" && <Typography.Paragraph type="secondary" style={{ marginTop: -token.marginXS }}>{t("labels.shelfHint")}</Typography.Paragraph>}
          <Form.Item label={t("labels.baseUrl")} extra={t("labels.baseUrlHelp")}>
            <Input value={baseUrl} placeholder={origin} onChange={(event) => setBaseUrl(event.target.value)} inputMode="url" />
          </Form.Item>
          {isLocalhostUrl(effectiveBase) && <Alert type="warning" showIcon title={t("labels.localhostWarning")} style={{ marginBottom: 16 }} />}
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("labels.preview")}
        </Typography.Text>
        <Flex
          wrap
          gap={8}
          justify="center"
          style={{ marginTop: 8, padding: 16, maxHeight: 280, overflowY: "auto", borderRadius: token.borderRadiusLG, background: token.colorFillTertiary }}
        >
          {labels.map((label) => (
            <div key={label.id} style={{ boxShadow: token.boxShadowTertiary, borderRadius: 2, zoom: width >= 90 ? 0.8 : width > 60 ? 1.1 : 1.3 }}>
              <ContainerLabel label={label} size={size} url={containerQrUrl(effectiveBase, label.code)} />
            </div>
          ))}
        </Flex>
      </Modal>

      {printing && createPortal(<PrintArea labels={labels} size={size} baseUrl={effectiveBase} />, document.body)}
    </>
  );
}

/** Lo único visible al imprimir (ver `.od-print-root` en globals.css). */
function PrintArea({ labels, size, baseUrl }: { labels: LabelData[]; size: LabelSize; baseUrl: string }) {
  const { page, perRow, width } = LABEL_SIZES[size];
  const isSheet = perRow > 1;

  return (
    <div className="od-print-root">
      <style>{`@page { size: ${page}; margin: ${isSheet ? "12mm 10mm" : "0"}; }`}</style>
      <div
        style={
          isSheet
            ? { display: "grid", gridTemplateColumns: `repeat(${perRow}, ${width}mm)`, gap: "0 2.5mm", justifyContent: "center" }
            : undefined
        }
      >
        {labels.map((label) => (
          <div key={label.id} style={isSheet ? { breakInside: "avoid" } : { breakAfter: "page" }}>
            <ContainerLabel label={label} size={size} url={containerQrUrl(baseUrl, label.code)} />
          </div>
        ))}
      </div>
    </div>
  );
}
