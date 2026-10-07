"use client";

import { Flex, Typography, theme } from "antd";
import { ExternalLink } from "lucide-react";
import { Callout } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { referenceFor, referenceNeedsReview } from "../references";

export function ReferencePrice({ catalogId }: { catalogId: string }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const reference = referenceFor(catalogId);
  if (!reference) return <Callout>{t("prices.reference.unavailable")}</Callout>;
  const stale = referenceNeedsReview(reference, now);
  return <Callout tone={stale ? "warning" : "neutral"} title={t("prices.reference.published", { amount: format.money(reference.amountCents, reference.currency) })}>
    <Flex vertical gap={token.marginXXS} style={{ fontSize: token.fontSizeSM }}>
      <span>{reference.product} · {reference.presentation}</span>
      <Typography.Link href={reference.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: token.marginXXS }}>
        {reference.store}<ExternalLink />
      </Typography.Link>
      <span>{t("prices.reference.consulted", { date: format.date(new Date(`${reference.consultedAt}T00:00:00Z`), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) })}</span>
      <span>{t("prices.reference.listPrice")}</span>
      <span>{t(stale ? "prices.reference.review" : "prices.reference.notice")}</span>
    </Flex>
  </Callout>;
}
