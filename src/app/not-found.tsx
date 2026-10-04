"use client";

import { Button, Card } from "antd";
import { ArrowLeft, MapPinOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { useT } from "@/i18n";
import { legacyRedirect } from "@/lib/navigation/routes";

/**
 * 404. Antes de rendirse, traduce URLs viejas a las nuevas: sobre todo `/c/<código>` de las
 * etiquetas QR ya impresas. Funciona igual en cualquier hosting estático, en `next dev` y en Android.
 */
export default function NotFound() {
  const t = useT();
  const router = useRouter();
  const [target] = useState(() => (typeof window === "undefined" ? null : legacyRedirect(window.location.pathname)));

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (target) return null;

  return (
    <Card>
      <EmptyState
        icon={MapPinOff}
        title={t("notFound.title")}
        description={t("notFound.text")}
        action={
          <Link href="/">
            <Button icon={<ArrowLeft />}>{t("forbidden.back")}</Button>
          </Link>
        }
      />
    </Card>
  );
}
