"use client";

import { Card, Collapse, Typography, theme } from "antd";
import type { ReactNode } from "react";

interface DemoBlockProps {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Snippet de uso recomendado. Se muestra plegado debajo de la demo. */
  code?: string;
  children: ReactNode;
}

/** Bloque de documentación: título + explicación + demo en vivo + código. */
export function DemoBlock({ id, title, description, code, children }: DemoBlockProps) {
  const { token } = theme.useToken();

  return (
    <Card id={id} title={title} style={{ scrollMarginTop: 88 }}>
      {description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {description}
        </Typography.Paragraph>
      )}
      {children}
      {code && (
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 16 }}
          items={[
            {
              key: "code",
              label: "Ver código",
              extra: <Typography.Text copyable={{ text: code.trim() }} onClick={(e) => e.stopPropagation()} />,
              children: (
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    overflowX: "auto",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono), monospace",
                    background: token.colorFillQuaternary,
                    borderRadius: token.borderRadius,
                  }}
                >
                  {code.trim()}
                </pre>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

/** Subtítulo dentro de un DemoBlock. */
export function DemoLabel({ children }: { children: ReactNode }) {
  return (
    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
      {children}
    </Typography.Text>
  );
}
