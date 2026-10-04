import { renderAppIcon } from "@/lib/pwa/icon";

/** Íconos del manifest con URLs fijas (`/icons/192.png`…). Se generan una vez, en el build. */
const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "192.png": { size: 192 },
  "512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response(null, { status: 404 });
  return renderAppIcon(icon.size, { maskable: icon.maskable });
}
