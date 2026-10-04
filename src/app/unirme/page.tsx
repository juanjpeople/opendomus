import { JoinPage } from "@/features/cloud/components/JoinPage";
import { LocalOnlyPage } from "@/features/cloud/components/LocalOnlyPage";
import { CLOUD_ENABLED } from "@/lib/cloud/api";

/** Abrir una invitación: `/unirme#<id>.<secreto>` (el secreto nunca llega al servidor). */
export default function UnirmeRoute() {
  return CLOUD_ENABLED ? <JoinPage /> : <LocalOnlyPage />;
}
