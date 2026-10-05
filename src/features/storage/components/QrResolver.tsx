"use client";

import { Button, Card, Flex, Typography } from "antd";
import { ArrowLeft, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { EmptyState } from "@/components/ui";
import { useT } from "@/i18n";
import { containerHref } from "@/lib/navigation/routes";
import { normalizeContainerCode } from "../domain";
import { useContainerByCode } from "../hooks";

/**
 * Destino del QR de una etiqueta. Si el contenedor existe en este dispositivo, redirige a su página;
 * si no, informa que no está disponible entre los datos locales.
 */
export function QrResolver() {
  const t = useT();
  const router = useRouter();
  const code = useSearchParams().get("code") ?? "";
  const container = useContainerByCode(code);

  useEffect(() => {
    // replace: "atrás" no debe volver a esta página intermedia.
    if (container) router.replace(containerHref(container.id));
  }, [container, router]);

  if (container === null) {
    return (
      <Card>
        <EmptyState
          icon={PackageSearch}
          title={t("qr.notFoundTitle")}
          description={t("qr.notFoundText", { code: normalizeContainerCode(code) })}
          action={
            <Link href="/inventario">
              <Button icon={<ArrowLeft />}>{t("qr.back")}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Flex vertical align="center" gap={16} style={{ paddingBlock: 64 }} role="status">
      <HouseMark size={48} loading />
      <Typography.Text type="secondary">{t("qr.resolving")}</Typography.Text>
    </Flex>
  );
}
