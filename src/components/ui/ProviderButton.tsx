"use client";

import { Button, theme } from "antd";
import type { ReactNode } from "react";

/** Marca monocroma, nombre explícito y los mismos estados que cualquier botón de la app. */
export function ProviderButton({ provider, children, loading = false, disabled = false, onClick }: {
  provider: "google" | "github"; children: ReactNode; loading?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  const { token } = theme.useToken();
  return <Button aria-label={typeof children === "string" ? children : undefined} aria-busy={loading} block size="large" loading={loading} disabled={disabled} onClick={onClick}
    style={{ minHeight: 44, height: "auto", paddingBlock: token.paddingXS, whiteSpace: "normal" }}
    icon={<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      {provider === "google" ? <path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22ZM6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59ZM12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.95Z" />
        : <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18a4.63 4.63 0 0 1 1.23 3.22c0 4.6-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.31c0 .32.22.7.82.58A12 12 0 0 0 12 .3Z" />}
    </svg>}>
    {children}
  </Button>;
}
