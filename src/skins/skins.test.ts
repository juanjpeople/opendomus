import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { theme } from "antd";
import { DEFAULT_PREFERENCES, isValidPreference, sanitizePreferences } from "@/lib/preferences";
import { createTheme } from "@/lib/theme";
import { DEFAULT_SKIN, SKINS } from "./skins";
import { SKIN_IDS } from "./types";

type Rgb = [number, number, number];

/** Lee "#rrggbb" o "rgba(r, g, b, a)" y lo mezcla sobre `under` si tiene transparencia. */
function parse(color: string, under: Rgb = [255, 255, 255]): Rgb {
  if (color.startsWith("#")) {
    const hex = color.length === 4 ? [...color.slice(1)].map((c) => c + c).join("") : color.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  return [r, g, b].map((channel, i) => Math.round(channel * a + under[i] * (1 - a))) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(foreground: string, background: string): number {
  const bg = parse(background);
  const [a, b] = [luminance(parse(foreground, bg)), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("skins", () => {
  test("el skin por defecto no cambia ningún token de antd", () => {
    const base = createTheme(DEFAULT_PREFERENCES, false);
    const withSkin = createTheme(DEFAULT_PREFERENCES, false, SKINS[DEFAULT_SKIN]);
    assert.deepEqual(withSkin, base);
    assert.equal(SKINS[DEFAULT_SKIN].brandColor, DEFAULT_PREFERENCES.brandColor);
    assert.equal(SKINS[DEFAULT_SKIN].borderRadius, DEFAULT_PREFERENCES.borderRadius);
  });

  test("la preferencia solo acepta skins del catálogo", () => {
    for (const id of SKIN_IDS) assert.equal(isValidPreference("skin", id), true);
    assert.equal(isValidPreference("skin", "neon"), false);
    assert.deepEqual(sanitizePreferences({ skin: "calido", otra: 1 }), { skin: "calido" });
    assert.deepEqual(sanitizePreferences({ skin: "neon" }), {});
  });

  // "Casa" es el aspecto original y se conserva tal cual (su marca azul queda por debajo de AA en algunos pares);
  // los skins nuevos tienen que cumplir: texto neutro AA (4.5) y marca al menos como "Casa" en oscuro (3.5).
  for (const id of SKIN_IDS.filter((skinId) => skinId !== DEFAULT_SKIN)) {
    for (const dark of [false, true]) {
      test(`${id} (${dark ? "oscuro" : "claro"}) cumple contraste AA`, () => {
        const skin = SKINS[id];
        const config = createTheme({ ...DEFAULT_PREFERENCES, brandColor: skin.brandColor, borderRadius: skin.borderRadius }, dark, skin);
        const token = theme.getDesignToken(config);
        const checks: [string, string, string][] = [
          ["texto", token.colorText, token.colorBgContainer],
          ["texto sobre el fondo", token.colorText, token.colorBgLayout],
          ["texto sobre lo seleccionado", token.colorText, token.colorPrimaryBg],
          ["texto secundario", token.colorTextSecondary, token.colorBgContainer],
          ["texto secundario sobre el fondo", token.colorTextSecondary, token.colorBgLayout],
        ];
        const brand: [string, string, string][] = [
          ["texto del botón principal", token.colorTextLightSolid, token.colorPrimary],
          ["enlaces y texto de marca", token.colorPrimaryText, token.colorBgContainer],
        ];
        for (const [name, fg, bg] of checks) {
          const ratio = contrast(fg, bg);
          assert.ok(ratio >= 4.5, `${id}/${dark ? "dark" : "light"}: ${name} tiene contraste ${ratio.toFixed(2)} (mínimo 4.5)`);
        }
        for (const [name, fg, bg] of brand) {
          const ratio = contrast(fg, bg);
          assert.ok(ratio >= 3.5, `${id}/${dark ? "dark" : "light"}: ${name} tiene contraste ${ratio.toFixed(2)} (mínimo 3.5)`);
        }
      });
    }
  }
});
