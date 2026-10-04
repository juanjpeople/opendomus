"use client";

import { Button, Col, Flex, Grid, Row, Tag, Typography, theme } from "antd";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { ArrowDown, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { House } from "@/components/illustrations/House";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { LanguageSwitch, ThemeModeSwitch } from "@/components/layout/HeaderActions";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { GUIDELINES, ROADMAP, TRANSPARENCY_STAGES, TRUST_PROOFS, VALUES } from "./content";
import { useHydrated } from "@/hooks/useHydrated";
import { useDeviceStore } from "@/store/useDeviceStore";

const MAX_WIDTH = 1160;

export function Landing() {
  const { token } = theme.useToken();

  return (
    <div style={{ background: token.colorBgLayout, color: token.colorText, minHeight: "100vh" }}>
      <LandingHeader />
      <Hero />
      <ValuesSection />
      <TransparencySection />
      <GuidelinesSection />
      <RoadmapSection />
      <Closing />
    </div>
  );
}

function Container({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ maxWidth: MAX_WIDTH, margin: "0 auto", paddingInline: 20, ...style }}>{children}</div>;
}

/**
 * Entrada a la app: la primera vez lleva a la bienvenida (crear casa, unirse o probar);
 * si este dispositivo ya tiene su casa, directo a ella.
 */
function EnterButton({ size }: { size?: "large" }) {
  const t = useT();
  const hydrated = useHydrated();
  const mode = useDeviceStore((s) => s.mode);
  const returning = hydrated && mode !== "unset";
  return (
    <Link href={returning ? "/" : "/empezar"}>
      <Button type="primary" size={size} icon={size ? <ArrowRight /> : undefined} iconPlacement="end">
        {returning ? t("landing.goHome") : size ? t("landing.hero.primary") : t("landing.start")}
      </Button>
    </Link>
  );
}

function LandingHeader() {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(12px)",
        background: `color-mix(in srgb, ${token.colorBgLayout} 80%, transparent)`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Container>
        <Flex align="center" justify="space-between" gap={16} style={{ height: 64 }}>
          <Flex align="center" gap={10}>
            <HouseMark size={26} />
            <Typography.Text strong style={{ fontSize: token.fontSizeXL, color: token.colorPrimary, letterSpacing: "-0.02em" }}>
              {t("common.appName")}
            </Typography.Text>
          </Flex>
          <Flex align="center" gap={12}>
            <LanguageSwitch />
            {screens.sm && <ThemeModeSwitch />}
            <EnterButton />
          </Flex>
        </Flex>
      </Container>
    </header>
  );
}

/** Título de sección con entrada al hacer scroll. */
function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { token } = theme.useToken();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.6 }}
      style={{ maxWidth: 680, marginBottom: 48 }}
    >
      <Typography.Text strong style={{ color: token.colorPrimary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}>
        {eyebrow}
      </Typography.Text>
      <Typography.Title level={2} style={{ margin: "8px 0 12px", fontSize: "clamp(1.9rem, 4vw, 2.75rem)", letterSpacing: "-0.02em" }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ fontSize: "1.25rem", margin: 0 }}>
        {description}
      </Typography.Paragraph>
    </motion.div>
  );
}

function Hero() {
  const { token } = theme.useToken();
  const t = useT();
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section
      style={{
        background: `radial-gradient(ellipse at 75% 45%, ${token.colorPrimaryBg}, transparent 60%)`,
        paddingBlock: "clamp(48px, 10vh, 120px)",
      }}
    >
      <Container>
        <Row gutter={[48, 48]} align="middle">
          <Col xs={24} md={13}>
            <motion.div {...fadeUp(0)}>
              <Flex gap={8} wrap>
                {(["open", "offline", "hardware"] as const).map((tag) => (
                  <Tag key={tag} color="processing" style={{ margin: 0 }}>
                    {t(`landing.hero.tags.${tag}`)}
                  </Tag>
                ))}
              </Flex>
            </motion.div>
            <motion.div {...fadeUp(0.1)}>
              <Typography.Title
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.035em",
                  margin: "24px 0",
                }}
              >
                {t("landing.hero.titleA")} <span style={{ color: token.colorPrimary }}>{t("landing.hero.titleB")}</span>
              </Typography.Title>
            </motion.div>
            <motion.div {...fadeUp(0.2)}>
              <Typography.Paragraph type="secondary" style={{ fontSize: "1.35rem", maxWidth: 540, marginBottom: 32 }}>
                {t("landing.hero.text")}
              </Typography.Paragraph>
            </motion.div>
            <motion.div {...fadeUp(0.3)}>
              <Flex gap={12} wrap>
                <EnterButton size="large" />
                <Button size="large" href="#valores" icon={<ArrowDown />} iconPlacement="end">
                  {t("landing.hero.secondary")}
                </Button>
              </Flex>
            </motion.div>
          </Col>
          <Col xs={24} md={11}>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              <House intro particles />
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

/**
 * Storytelling con scroll: la casa queda fija y cada valor que pasa enciende su ambiente.
 * El valor activo sale del progreso de scroll de la lista (sin observers por ítem).
 */
function ValuesSection() {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.md;
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start center", "end center"] });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const index = Math.min(VALUES.length - 1, Math.max(0, Math.floor(progress * VALUES.length)));
    setActiveIndex(index);
  });

  const active = VALUES[activeIndex];

  const stage = (
    <Flex vertical align="center" justify="center" gap={16} style={{ height: "100%" }}>
      <div style={{ width: "100%", maxWidth: isDesktop ? 440 : 240 }}>
        <House active={active.key} />
      </div>
      <Flex align="center" gap={12} style={{ minHeight: 28 }}>
        <Flex gap={6}>
          {VALUES.map((value, i) => (
            <motion.span
              key={value.key}
              animate={{ width: i === activeIndex ? 22 : 8, opacity: i === activeIndex ? 1 : 0.35 }}
              style={{ height: 8, borderRadius: 4, background: token.colorPrimary, display: "block" }}
            />
          ))}
        </Flex>
        {isDesktop && (
          <AnimatePresence mode="wait">
            <motion.span
              key={active.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <Typography.Text type="secondary">{t(`landing.values.items.${active.key}.title`)}</Typography.Text>
            </motion.span>
          </AnimatePresence>
        )}
      </Flex>
    </Flex>
  );

  return (
    <section id="valores" style={{ paddingBlock: "96px 48px", scrollMarginTop: 64 }}>
      <Container>
        <SectionTitle
          eyebrow={t("landing.values.eyebrow")}
          title={t("landing.values.title")}
          description={t("landing.values.description")}
        />
        <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", gap: isDesktop ? 64 : 0 }}>
          <div
            style={{
              position: "sticky",
              top: 64,
              zIndex: 1,
              flex: isDesktop ? "0 0 46%" : undefined,
              height: isDesktop ? "calc(100vh - 64px)" : "auto",
              // En mobile la casa queda fija arriba y tapa todo el ancho mientras pasan los valores.
              ...(isDesktop ? {} : { marginInline: -20, padding: "12px 20px", background: token.colorBgLayout }),
            }}
          >
            {stage}
          </div>
          <div ref={listRef} style={{ flex: 1 }}>
            {VALUES.map((value, i) => (
              <ValueItem key={value.key} index={i} active={i === activeIndex} value={value} tall={isDesktop} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ValueItem({
  value,
  index,
  active,
  tall,
}: {
  value: (typeof VALUES)[number];
  index: number;
  active: boolean;
  tall: boolean;
}) {
  const t = useT();

  return (
    <Flex vertical justify="center" style={{ minHeight: tall ? "70vh" : "55vh", paddingBlock: 24 }}>
      <motion.div animate={{ opacity: active ? 1 : 0.3, x: active ? 0 : -8 }} transition={{ duration: 0.4 }}>
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <IconTile icon={value.icon} solid={active} />
          <Typography.Text type="secondary" style={{ fontFamily: "var(--font-geist-mono)" }}>
            {String(index + 1).padStart(2, "0")} / {String(VALUES.length).padStart(2, "0")}
          </Typography.Text>
        </Flex>
        <Typography.Title level={3} style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          {t(`landing.values.items.${value.key}.title`)}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: "1.25rem", lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
          {t(`landing.values.items.${value.key}.text`)}
        </Typography.Paragraph>
      </motion.div>
    </Flex>
  );
}

function TransparencySection() {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.md;

  return (
    <section id="transparencia" style={{ paddingBlock: 96, background: token.colorBgContainer, scrollMarginTop: 64 }}>
      <Container>
        <SectionTitle
          eyebrow={t("landing.transparency.eyebrow")}
          title={t("landing.transparency.title")}
          description={t("landing.transparency.description")}
        />

        <div
          style={{
            padding: isDesktop ? 32 : 20,
            borderRadius: token.borderRadiusLG * 2,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: `radial-gradient(circle at 50% 0%, ${token.colorPrimaryBg}, ${token.colorBgLayout} 58%)`,
            boxShadow: token.boxShadowTertiary,
          }}
        >
          <Flex vertical={!isDesktop} align="stretch" gap={isDesktop ? 12 : 8}>
            {TRANSPARENCY_STAGES.map(({ key, icon: Icon }, index) => (
              <div key={key} style={{ display: "contents" }}>
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: 20,
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: `color-mix(in srgb, ${token.colorBgContainer} 88%, transparent)`,
                  }}
                >
                  <Flex align="center" justify="space-between" gap={12} style={{ marginBottom: 18 }}>
                    <IconTile icon={Icon} solid={key === "encryption"} />
                    <Typography.Text type="secondary" style={{ fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM }}>
                      {String(index + 1).padStart(2, "0")}
                    </Typography.Text>
                  </Flex>
                  <Typography.Title level={5} style={{ margin: "0 0 8px" }}>
                    {t(`landing.transparency.stages.${key}.title`)}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ margin: 0, lineHeight: 1.55 }}>
                    {t(`landing.transparency.stages.${key}.text`)}
                  </Typography.Paragraph>
                </motion.div>
                {index < TRANSPARENCY_STAGES.length - 1 && (
                  <Flex align="center" justify="center" aria-hidden style={{ color: token.colorPrimary, flex: "0 0 auto" }}>
                    {isDesktop ? <ArrowRight size={18} /> : <ArrowDown size={18} />}
                  </Flex>
                )}
              </div>
            ))}
          </Flex>
          <Flex align="center" gap={10} style={{ marginTop: 24, color: token.colorTextSecondary }}>
            <ShieldCheckMark />
            <Typography.Text type="secondary">{t("landing.transparency.diagramNote")}</Typography.Text>
          </Flex>
        </div>

        <div style={{ marginTop: 64 }}>
          <Typography.Title level={3} style={{ marginBottom: 8, fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
            {t("landing.transparency.proofTitle")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeLG, maxWidth: 720, marginBottom: 28 }}>
            {t("landing.transparency.proofDescription")}
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            {TRUST_PROOFS.map(({ key, icon, href }, index) => (
              <Col key={key} xs={24} sm={12} lg={6}>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                  style={{
                    height: "100%",
                    padding: 22,
                    borderRadius: token.borderRadiusLG * 1.5,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgLayout,
                  }}
                >
                  <IconTile icon={icon} size={42} />
                  <Typography.Title level={5} style={{ margin: "16px 0 8px" }}>
                    {t(`landing.transparency.proofs.${key}.title`)}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: href ? 16 : 0 }}>
                    {t(`landing.transparency.proofs.${key}.text`)}
                  </Typography.Paragraph>
                  {href && (
                    <Typography.Link href={href} target="_blank" rel="noreferrer">
                      <Flex component="span" align="center" gap={6}>
                        {t(`landing.transparency.proofs.${key}.link`)}
                        <ExternalLink size={14} aria-hidden />
                      </Flex>
                    </Typography.Link>
                  )}
                </motion.div>
              </Col>
            ))}
          </Row>
          <Typography.Paragraph type="secondary" style={{ margin: "20px 0 0", fontSize: token.fontSizeSM }}>
            {t("landing.transparency.auditNote")}
          </Typography.Paragraph>
        </div>
      </Container>
    </section>
  );
}

function ShieldCheckMark() {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden
      style={{
        width: 10,
        height: 10,
        flex: "0 0 auto",
        borderRadius: "50%",
        background: token.colorSuccess,
        boxShadow: `0 0 0 4px ${token.colorSuccessBg}`,
      }}
    />
  );
}

function GuidelinesSection() {
  const { token } = theme.useToken();
  const t = useT();
  const reduceMotion = useReducedMotion();

  return (
    <section id="lineamientos" style={{ paddingBlock: 96, background: token.colorBgContainer }}>
      <Container>
        <SectionTitle
          eyebrow={t("landing.guidelines.eyebrow")}
          title={t("landing.guidelines.title")}
          description={t("landing.guidelines.description")}
        />
        <Row gutter={[16, 16]}>
          {GUIDELINES.map(({ key, icon }, i) => (
            <Col key={key} xs={24} sm={12} lg={6}>
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={reduceMotion ? undefined : { y: -6 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
                style={{
                  height: "100%",
                  padding: 24,
                  borderRadius: token.borderRadiusLG * 1.5,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgLayout,
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <IconTile icon={icon} size={44} />
                </div>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {t(`landing.guidelines.items.${key}.title`)}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                  {t(`landing.guidelines.items.${key}.text`)}
                </Typography.Paragraph>
              </motion.div>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}

/** Hoja de ruta: la línea se va llenando con el scroll, como una obra que avanza. */
function RoadmapSection() {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.md;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });

  return (
    <section id="hoja-de-ruta" style={{ paddingBlock: 96 }}>
      <Container>
        <SectionTitle
          eyebrow={t("landing.roadmap.eyebrow")}
          title={t("landing.roadmap.title")}
          description={t("landing.roadmap.description")}
        />
        <div ref={ref} style={{ position: "relative" }}>
          {/* Riel y progreso. */}
          <div
            style={{
              position: "absolute",
              background: token.colorBorderSecondary,
              ...(isDesktop ? { top: 7, left: 0, right: 0, height: 2 } : { top: 0, bottom: 0, left: 7, width: 2 }),
            }}
          />
          <motion.div
            style={{
              position: "absolute",
              background: token.colorPrimary,
              ...(isDesktop
                ? { top: 7, left: 0, right: 0, height: 2, scaleX: progress, originX: 0 }
                : { top: 0, bottom: 0, left: 7, width: 2, scaleY: progress, originY: 0 }),
            }}
          />
          <Flex vertical={!isDesktop} gap={isDesktop ? 24 : 40}>
            {ROADMAP.map((phase, i) => (
              <motion.div
                key={phase.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: isDesktop ? i * 0.1 : 0 }}
                style={{ flex: 1, position: "relative", paddingTop: isDesktop ? 36 : 0, paddingLeft: isDesktop ? 0 : 36 }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: phase.current ? token.colorPrimary : token.colorBgLayout,
                    border: `2px solid ${phase.current ? token.colorPrimary : token.colorBorder}`,
                  }}
                />
                {phase.current && (
                  <motion.span
                    animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    style={{ position: "absolute", top: 0, left: 0, width: 16, height: 16, borderRadius: "50%", background: token.colorPrimary }}
                  />
                )}
                <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                  <Typography.Text type="secondary" style={{ fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM }}>
                    {t("landing.roadmap.phase", { n: i + 1 })}
                  </Typography.Text>
                  {phase.current && (
                    <Tag color="processing" style={{ margin: 0 }}>
                      {t("landing.roadmap.current")}
                    </Tag>
                  )}
                </Flex>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {t(`landing.roadmap.phases.${phase.key}.title`)}
                </Typography.Title>
                <Flex vertical gap={4}>
                  {t(`landing.roadmap.phases.${phase.key}.items`)
                    .split(" · ")
                    .map((item) => (
                      <Typography.Text key={item} type="secondary">
                        {item}
                      </Typography.Text>
                    ))}
                </Flex>
              </motion.div>
            ))}
          </Flex>
        </div>
      </Container>
    </section>
  );
}

function Closing() {
  const { token } = theme.useToken();
  const t = useT();

  return (
    <section style={{ paddingBlock: "96px 48px", background: token.colorBgContainer }}>
      <Container>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          style={{
            textAlign: "center",
            padding: "clamp(40px, 8vw, 80px) 24px",
            borderRadius: token.borderRadiusLG * 3,
            background: `radial-gradient(ellipse at 50% 0%, ${token.colorPrimaryBgHover}, ${token.colorPrimaryBg} 70%)`,
          }}
        >
          <Typography.Title level={2} style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", letterSpacing: "-0.02em", marginTop: 0 }}>
            {t("landing.closing.titleA")}
            <br />
            {t("landing.closing.titleB")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: "1.25rem", maxWidth: 560, margin: "0 auto 32px" }}>
            {t("landing.closing.text")}
          </Typography.Paragraph>
          <EnterButton size="large" />
        </motion.div>
        <Flex justify="space-between" wrap gap={8} style={{ marginTop: 48 }}>
          <Typography.Text type="secondary">{t("landing.closing.footerLeft")}</Typography.Text>
          <Typography.Text type="secondary">{t("landing.closing.footerRight")}</Typography.Text>
        </Flex>
      </Container>
    </section>
  );
}
