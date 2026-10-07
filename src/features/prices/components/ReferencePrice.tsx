"use client";

import { Typography } from "antd";
import { useI18n } from "@/i18n";
import { referenceFor, referenceNeedsReview } from "../references";

export function ReferencePrice({ catalogId }: { catalogId: string }) {
  const { locale, format } = useI18n();
  const reference = referenceFor(catalogId);
  const es = locale === "es";
  if (!reference) return <Typography.Text type="secondary">{es ? "Sin precio de referencia verificado" : "No verified reference price"}</Typography.Text>;
  return <div style={{ fontSize: 12 }}>
    <Typography.Text strong>{es ? "Referencia publicada: " : "Published reference: "}{format.money(reference.amountCents, "ARS")}</Typography.Text>
    <div>{reference.product} · {reference.presentation}</div>
    <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.store}</a>
    <div>{es ? "Consulta" : "Consulted"}: {reference.consultedAt} · {es ? "Precio de lista, sin envío" : "List price, excludes delivery"}</div>
    <Typography.Text type="secondary">{referenceNeedsReview(reference)
      ? (es ? "Referencia a revisar. Confirmá el precio en el comercio." : "Reference needs review. Check the store price.")
      : (es ? "No es una cotización en vivo. Puede variar por zona." : "Not a live quote. Prices may vary by location.")}</Typography.Text>
  </div>;
}
