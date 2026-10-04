import { QrResolver } from "@/features/storage/components/QrResolver";

/** Destino de las etiquetas QR: /c/<código> → página del contenedor. */
export default function QrRoute() {
  return <QrResolver />;
}
