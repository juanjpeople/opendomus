"use client";

import { theme } from "antd";
import type { ReactNode } from "react";
import { tint } from "@/lib/appearance";
import { containerAppearance, type Container } from "../domain";
import styles from "./storage.module.css";

/**
 * Siluetas compartidas por tarjetas, fichas y editor. El color y el ícono siguen siendo configurables.
 * `bare`: solo la silueta, sin fondo ni insignia (sobre el visor de cámara u otra superficie propia).
 */
export function ContainerScene({ container, compact = false, bare = false }: { container: Pick<Container, "kind" | "color" | "icon">; compact?: boolean; bare?: boolean }) {
  const { token } = theme.useToken();
  const { color, Icon } = containerAppearance(container);
  const palette = tint(token, color);
  const panel = token.colorBgContainer;
  const shapes: Record<Container["kind"], ReactNode> = {
    fridge: <><rect x="49" y="10" width="82" height="102" rx="10" /><path d="M49 48h82M62 24v12M62 62v24" /><path d="M59 113v3m62-3v3" /></>,
    freezer: <><rect x="24" y="42" width="132" height="66" rx="8" /><rect x="21" y="33" width="138" height="14" rx="5" /><path d="M78 57h24M36 109v6m108-6v6" /><path d="M128 73v20m-9-15 18 10m-18 0 18-10" /></>,
    wardrobe: <><rect x="34" y="10" width="112" height="101" rx="7" /><path d="M90 11v99M81 53v16m18-16v16M43 112v4m94-4v4" /><path d="m46 23 33 0m22 0h33" opacity=".35" /></>,
    pantry: <><rect x="37" y="12" width="106" height="100" rx="7" /><path d="M38 49h104M38 85h104M46 112v4m88-4v4" /><rect x="49" y="25" width="18" height="24" rx="3" /><rect x="75" y="20" width="23" height="29" rx="3" /><path d="M79 25h15" /><rect x="106" y="28" width="23" height="21" rx="3" /><rect x="51" y="63" width="29" height="22" rx="3" /><rect x="94" y="58" width="33" height="27" rx="3" /></>,
    shelf: <><path d="M29 15v99m122-99v99M25 48h130M25 83h130M25 109h130" /><rect x="39" y="20" width="32" height="28" rx="3" /><path d="M81 48V25h14v23m6 0V19h13v29m5 0 4-27 13 2-4 25" /><rect x="41" y="63" width="48" height="20" rx="3" /><rect x="100" y="58" width="37" height="25" rx="3" /></>,
    cabinet: <><rect x="28" y="27" width="124" height="81" rx="7" /><path d="M90 28v79M78 55v17m24-17v17M39 109v7m102-7v7" /><path d="M24 25h132" /></>,
    bed: <><rect x="20" y="52" width="140" height="48" rx="6" /><rect x="26" y="35" width="128" height="40" rx="10" /><rect x="36" y="40" width="41" height="21" rx="6" /><rect x="103" y="40" width="41" height="21" rx="6" /><path d="M21 75h138M27 101v13m126-13v13" /><rect x="65" y="86" width="50" height="23" rx="4" /><path d="M83 94h14" /></>,
    drawer: <><path d="M34 28h112l17 37H17Z" /><rect x="17" y="65" width="146" height="43" rx="6" /><path d="M71 81v8h38v-8" /><path d="M43 40h94" opacity=".4" /></>,
    door: <><rect x="48" y="10" width="84" height="103" rx="5" /><rect x="57" y="20" width="66" height="81" rx="3" /><path d="M108 65h12" /><circle cx="111" cy="70" r="1" /></>,
    compartment: <><rect x="27" y="19" width="126" height="89" rx="7" /><path d="M69 20v87m42-87v87M28 63h124" /><path d="m39 36 17 0m26 0h17m24 0h17m-101 44h17m26 0h17m24 0h17" strokeWidth="6" opacity=".35" /></>,
    box: <><path d="M32 42 90 24l58 18v61l-58 12-58-12Z" /><path d="m32 42 58 15 58-15M90 57v58M62 33l58 17v23l-16 4V54" /><path d="m44 78 26 6v14l-26-6Z" fill={panel} /></>,
    basket: <><path d="m22 48 13 56q55 15 110 0l13-56Z" /><path d="M50 47q0-42 40-42t40 42" fill="none" /><path d="M43 53l7 51m14-48 4 52m22-51v53m26-54-4 52m25-55-7 51M28 66q62 16 124 0M32 84q58 16 116 0" opacity=".55" /><rect x="18" y="43" width="144" height="12" rx="6" /></>,
    toolbox: <><path d="M65 32V19h50v13" fill="none" strokeWidth="6" /><rect x="22" y="33" width="136" height="77" rx="9" /><path d="M23 62h134" /><rect x="51" y="55" width="13" height="20" rx="3" fill={panel} /><rect x="116" y="55" width="13" height="20" rx="3" fill={panel} /><path d="M42 93h96" opacity=".4" /></>,
    other: <><rect x="29" y="34" width="122" height="75" rx="18" /><path d="M67 34v-9h46v9M71 65h38" /><circle cx="90" cy="84" r="4" /></>,
  };
  return <div className={`${styles.scene} ${compact ? styles.compact : ""}`} style={{ color: palette.solid, background: bare ? undefined : `linear-gradient(145deg, ${palette.bg}, ${token.colorBgContainer})` }} aria-hidden="true" data-container-kind={container.kind}>
    <svg viewBox="0 0 180 130" fill="none" focusable="false">
      <ellipse cx="90" cy="119" rx="67" ry="5" fill="currentColor" opacity=".1" />
      <circle cx="147" cy="21" r="4" fill="currentColor" opacity=".18" />
      <path d="M23 22v8m-4-4h8" stroke="currentColor" opacity=".3" strokeLinecap="round" />
      <g fill={palette.bgHover} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">{shapes[container.kind]}</g>
    </svg>
    {!bare && <span className={styles.contentBadge} style={{ color: palette.text, background: panel, borderColor: palette.border }}><Icon /></span>}
  </div>;
}
