import { JoinPage } from "@/features/cloud/components/JoinPage";

/** Abrir una invitación: `/unirme#<id>.<secreto>` (el secreto nunca llega al servidor). */
export default function UnirmeRoute() {
  return <JoinPage />;
}
