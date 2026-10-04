"use client";

import { theme } from "antd";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useT } from "@/i18n";

const GROUND = "M30 330 H370";
const WALLS = "M80 152 V330 H320 V152";
const ROOF = "M60 160 L200 50 L340 160";
const CHIMNEY = "M270 105 V72 H295 V125";
const FLOOR = "M80 245 H320";
const CLOUD = "M44 82 a14 14 0 0 1 4 -27 a20 20 0 0 1 38 -6 a15 15 0 0 1 12 33 z";
const SILHOUETTE = "M60 160 L200 50 L340 160 H320 V330 H80 V160 Z";

const WINDOWS = [
  { id: "cuentas", x: 100, y: 170, w: 80, h: 56 },
  { id: "familia", x: 220, y: 170, w: 80, h: 56 },
  { id: "alacena", x: 100, y: 262, w: 60, h: 46 },
  { id: "datos", x: 240, y: 262, w: 60, h: 46 },
] as const;

/** Recorridos de los "datos" que circulan entre ambientes, siempre dentro de la casa. */
const PARTICLE_ROUTES = [
  { cx: [140, 200, 260, 200, 270, 200, 130, 200, 140], cy: [198, 225, 198, 225, 285, 300, 285, 225, 198] },
  { cx: [270, 200, 130, 200, 140, 200, 260, 270], cy: [285, 300, 285, 225, 198, 225, 198, 285] },
  { cx: [130, 200, 260, 200, 130], cy: [285, 225, 198, 300, 285] },
];

const INTRO_END = 3.2;

/** Partes de la casa que se pueden resaltar (cada valor de OpenDomus enciende una). */
export type HouseHighlight = "datos" | "offline" | "cuentas" | "familia" | "abierto" | "calma";

interface HouseProps {
  /** Valor resaltado. `null` = casa en reposo. */
  active?: HouseHighlight | null;
  /** Dibuja la casa trazo por trazo al montarse. */
  intro?: boolean;
  /** Muestra los datos circulando entre ambientes. */
  particles?: boolean;
}

export function House({ active = null, intro = false, particles = false }: HouseProps) {
  const { token } = theme.useToken();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const animateIntro = intro && !reduceMotion;
  const introDelay = animateIntro ? INTRO_END : 0;

  const line = token.colorText;
  const accent = token.colorPrimary;
  const is = (key: HouseHighlight) => active === key;

  /** Props para que un trazo se dibuje en la intro (o aparezca completo si no hay intro). */
  const draw = (delay: number, duration = 0.8) =>
    animateIntro
      ? {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { delay, duration, ease: "easeInOut" } as Transition,
        }
      : {};

  const fadeIn = (delay: number) =>
    animateIntro ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.5 } } : {};

  // Color como atributo (no en `style`): así se actualiza al cambiar de tema o de valor activo.
  const stroke = (highlighted: boolean) => ({
    stroke: highlighted ? accent : line,
    style: { transition: "stroke 0.5s" },
  });

  return (
    <svg
      viewBox="0 0 400 350"
      role="img"
      aria-label={t("house.label")}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Halo: la casa como límite de tus datos. */}
      <motion.path
        d={SILHOUETTE}
        fill={token.colorPrimaryBg}
        stroke="none"
        initial={false}
        animate={{ opacity: is("datos") ? 1 : 0, scale: is("datos") ? 1.06 : 1 }}
        transition={{ duration: 0.6 }}
        style={{ originX: 0.5, originY: 0.6 }}
      />

      {/* Nube e internet: conexión opcional, la casa no depende de ella. */}
      <motion.g {...fadeIn(2.6)}>
        <path d={CLOUD} {...stroke(is("offline"))} opacity={0.7} strokeWidth={2.5} />
        <motion.line
          x1={92}
          y1={86}
          x2={126}
          y2={108}
          strokeWidth={2}
          strokeDasharray="4 6"
          {...stroke(is("offline"))}
          animate={{
            opacity: is("offline") ? 0.15 : 0.6,
            strokeDashoffset: reduceMotion ? 0 : [0, -20],
          }}
          transition={{
            opacity: { duration: 0.4 },
            strokeDashoffset: { duration: 1.2, repeat: Infinity, ease: "linear" },
          }}
        />
        <motion.line
          x1={38}
          y1={42}
          x2={104}
          y2={94}
          stroke={accent}
          strokeWidth={3.5}
          initial={false}
          animate={{ pathLength: is("offline") ? 1 : 0, opacity: is("offline") ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />
      </motion.g>

      {/* Humo de la chimenea: la casa está viva (y tranquila). */}
      {!reduceMotion &&
        [0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={282}
            fill={is("calma") ? accent : token.colorTextQuaternary}
            style={{ transition: "fill 0.5s" }}
            initial={{ cy: 64, r: 3, opacity: 0 }}
            animate={{ cy: [64, 14], cx: [282, 290 + i * 4], r: [3, 10], opacity: [0, is("calma") ? 0.9 : 0.5, 0] }}
            transition={{ duration: 3.6, delay: introDelay + i * 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        ))}

      {/* Estructura. */}
      <motion.path d={GROUND} {...stroke(false)} {...draw(0, 0.6)} />
      <motion.path d={WALLS} {...stroke(is("datos"))} strokeWidth={is("datos") ? 4.5 : 3} {...draw(0.3, 1)} />
      <motion.path d={ROOF} {...stroke(is("datos"))} strokeWidth={is("datos") ? 4.5 : 3} {...draw(1, 0.8)} />
      <motion.path d={CHIMNEY} {...stroke(is("calma"))} {...draw(1.6, 0.5)} />
      <motion.path d={FLOOR} {...stroke(false)} strokeOpacity={0.35} strokeWidth={2} {...draw(1.8, 0.5)} />

      {/* Ventanas: se encienden una por una. */}
      {WINDOWS.map((win, i) => {
        const highlighted = is(win.id as HouseHighlight);
        return (
          <g key={win.id}>
            <title>{t(`house.rooms.${win.id}`)}</title>
            <motion.rect
              x={win.x}
              y={win.y}
              width={win.w}
              height={win.h}
              rx={6}
              stroke="none"
              initial={animateIntro ? { opacity: 0 } : false}
              animate={{
                opacity: 1,
                fill: highlighted ? token.colorPrimaryBgHover : token.colorWarning,
                fillOpacity: highlighted ? 1 : 0.35,
              }}
              transition={{ opacity: { delay: animateIntro ? 2.4 + i * 0.2 : 0, duration: 0.6 }, default: { duration: 0.5 } }}
            />
            <motion.rect
              x={win.x}
              y={win.y}
              width={win.w}
              height={win.h}
              rx={6}
              {...stroke(highlighted)}
              {...draw(1.9 + i * 0.1, 0.6)}
            />
          </g>
        );
      })}

      {/* Glifos de cada valor dentro de su ambiente. */}
      <Glyph show={is("cuentas")} color={accent}>
        <circle cx={140} cy={198} r={15} />
        <path d="M145 191 h-8 a3.5 3.5 0 0 0 0 7 h6 a3.5 3.5 0 0 1 0 7 h-8 M140 187 v22" strokeWidth={2.5} />
      </Glyph>
      <Glyph show={is("familia")} color={accent}>
        <circle cx={249} cy={189} r={5} />
        <circle cx={271} cy={189} r={5} />
        <circle cx={260} cy={201} r={3.5} />
        <path d="M240 214 a9 9 0 0 1 18 0 M262 214 a9 9 0 0 1 18 0 M254 216 a6 6 0 0 1 12 0" strokeWidth={2.5} />
      </Glyph>
      <Glyph show={is("datos")} color={accent}>
        <rect x={260} y={284} width={20} height={15} rx={3} />
        <path d="M265 284 v-5 a5 5 0 0 1 10 0 v5" strokeWidth={2.5} />
      </Glyph>

      {/* Puerta: se abre con "Puertas abiertas". Detrás, luz. */}
      <motion.rect
        x={182}
        y={262}
        width={36}
        height={68}
        stroke="none"
        fill={is("abierto") ? token.colorPrimaryBgHover : token.colorWarning}
        fillOpacity={is("abierto") ? 1 : 0.35}
        style={{ transition: "fill 0.5s" }}
        {...fadeIn(2.2)}
      />
      <motion.g
        initial={false}
        animate={{ scaleX: is("abierto") ? 0.22 : 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        style={{ originX: 0 }}
      >
        <motion.rect
          x={182}
          y={262}
          width={36}
          height={68}
          rx={3}
          fill={token.colorBgContainer}
          {...stroke(is("abierto"))}
          {...draw(2, 0.6)}
        />
        <motion.circle cx={210} cy={298} r={2.5} fill={line} stroke="none" {...fadeIn(2.4)} />
      </motion.g>

      {/* Datos que circulan, sin salir nunca de la casa. */}
      {particles &&
        !reduceMotion &&
        PARTICLE_ROUTES.map((route, i) => (
          <motion.circle
            key={i}
            r={4}
            fill={accent}
            stroke="none"
            initial={{ cx: route.cx[0], cy: route.cy[0], opacity: 0 }}
            animate={{ cx: route.cx, cy: route.cy, opacity: 1 }}
            transition={{
              cx: { duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: introDelay + i * 0.8 },
              cy: { duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: introDelay + i * 0.8 },
              opacity: { delay: introDelay + i * 0.8, duration: 0.4 },
            }}
          />
        ))}
    </svg>
  );
}

function Glyph({ show, color, children }: { show: boolean; color: string; children: React.ReactNode }) {
  return (
    <motion.g
      stroke={color}
      strokeWidth={3}
      initial={false}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.6 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      style={{ originX: 0.5, originY: 0.5, pointerEvents: "none" }}
    >
      {children}
    </motion.g>
  );
}
