import { test } from "node:test";
import assert from "node:assert/strict";
import { componentFiles, inspect, undocumented } from "./design-lint.mjs";

/** Usos legítimos: valores fuera del tema y cálculos por locale que no son textos. */
const ALLOWED = {
  // Inicio de semana: calcula un día, no elige textos por idioma.
  "src/features/calendar/components/CalendarPage.tsx": { localeTernary: 1 },
  // themeColor del navegador: metadata, se resuelve antes de que exista el tema.
  "src/app/layout.tsx": { color: 2 },
  // Etiqueta impresa: blanco y negro puros, para que el QR se lea en cualquier impresora.
  "src/features/storage/components/ContainerLabel.tsx": { color: 2 },
  // Ícono PNG generado (ImageResponse): no hay tema en el servidor.
  "src/lib/pwa/icon.tsx": { color: 3 },
};

/**
 * Deuda conocida al 2026-10-07 (ver docs/UNIFICACION_VISUAL.md). Solo puede bajar: al arreglar un
 * archivo, bajá su número acá (o borralo). Un archivo nuevo o un número más alto hace fallar la prueba.
 */
const DEBT = {
};

const FIX = {
  color: "colores escritos a mano: usá theme.useToken() (o tint() para el color de una entidad)",
  localeTernary: "textos por idioma en el componente: pasalos a i18n/messages y usá t()",
  iconSize: "íconos lucide con size: sacá el size y subí el font-size del contenedor",
};

const files = [...componentFiles("src"), ...componentFiles("operator")];

test("ningún componente suma colores fijos, textos por idioma ni íconos con tamaño fijo", () => {
  const problems = [];
  for (const file of files) {
    const found = inspect(file);
    for (const [rule, value] of Object.entries(found)) {
      const limit = (ALLOWED[file]?.[rule] ?? 0) + (DEBT[file]?.[rule] ?? 0);
      if (value > limit) problems.push(`${file}: ${value} ${FIX[rule]} (máximo ${limit})`);
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join("\n")}\nVer /design y docs/UNIFICACION_VISUAL.md.`);
});

test("cada pieza de @/components/ui y @/components/motion está documentada en /design", () => {
  const missing = undocumented(["src/components/ui/index.ts", "src/components/motion/index.ts"]);
  assert.deepEqual(missing, [], `Mostralas en src/app/design/_components (con DemoBlock) antes de usarlas: ${missing.join(", ")}`);
});

test("la deuda registrada sigue existiendo (si bajó, actualizá DEBT)", (t) => {
  const stale = [];
  for (const [file, rules] of Object.entries(DEBT)) {
    const found = files.includes(file) ? inspect(file) : { color: 0, localeTernary: 0, iconSize: 0 };
    for (const [rule, limit] of Object.entries(rules)) {
      if (found[rule] < limit) stale.push(`${file}: ${rule} ${found[rule]} (registrado ${limit})`);
    }
  }
  // No falla: avisa, para que el número baje y no se pueda volver a subir.
  for (const line of stale) t.diagnostic(`deuda saldada, bajá DEBT → ${line}`);
});
