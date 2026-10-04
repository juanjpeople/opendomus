"use client";

import { Flex, Input, Modal, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, CornerDownLeft, Search } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { useUiStore } from "@/store/useNavigationStore";
import { useCommands, type Command } from "./useCommands";

/** Minúsculas y sin tildes: "configuracion" encuentra "Configuración". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function filterCommands(commands: Command[], query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  // Sin búsqueda, contenedores y productos no se listan: son muchos y se encuentran escribiendo.
  if (words.length === 0) return commands.filter((command) => !["containers", "items", "recipes"].includes(command.group));
  // Con búsqueda, los recientes se ocultan (ya aparecen como páginas).
  return commands.filter((command) => {
    if (command.group === "recent") return false;
    const haystack = normalize(`${command.label} ${command.keywords ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Búsqueda global de páginas y acciones. Se abre con Ctrl/⌘+K o desde el header. */
export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={false}
      width={560}
      style={{ top: "12vh" }}
      styles={{ container: { padding: 0, overflow: "hidden" } }}
      destroyOnHidden
    >
      <PaletteContent onClose={() => setOpen(false)} />
    </Modal>
  );
}

function PaletteContent({ onClose }: { onClose: () => void }) {
  const { token } = theme.useToken();
  const t = useT();
  const commands = useCommands();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = filterCommands(commands, query);
  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((results.length + active + step) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    }
  }

  const kbd = (children: React.ReactNode) => (
    <Typography.Text keyboard style={{ fontSize: token.fontSizeSM }}>
      {children}
    </Typography.Text>
  );

  return (
    <div onKeyDown={onKeyDown}>
      <Input
        autoFocus
        size="large"
        variant="borderless"
        prefix={<Search style={{ color: token.colorTextTertiary }} />}
        placeholder={t("palette.placeholder")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        style={{ padding: "16px 20px", fontSize: token.fontSizeLG }}
        aria-controls="command-results"
      />
      <div style={{ height: 1, background: token.colorBorderSecondary }} />

      <div ref={listRef} id="command-results" role="listbox" style={{ maxHeight: "50vh", overflowY: "auto", padding: 8 }}>
        {results.length === 0 && (
          <Typography.Paragraph type="secondary" style={{ textAlign: "center", padding: 24, margin: 0 }}>
            {t("palette.empty", { query })}
          </Typography.Paragraph>
        )}
        {results.map((command, index) => {
          const Icon = command.icon;
          const isActive = index === active;
          const showGroup = index === 0 || results[index - 1].group !== command.group;
          return (
            <Fragment key={command.id}>
              {showGroup && (
                <Typography.Text
                  type="secondary"
                  style={{ display: "block", fontSize: token.fontSizeSM, padding: "10px 12px 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  {t(`palette.groups.${command.group}`)}
                </Typography.Text>
              )}
              <div
                data-index={index}
                role="option"
                aria-selected={isActive}
                onMouseMove={() => index !== active && setActiveIndex(index)}
                onClick={() => run(command)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: token.borderRadiusLG,
                  cursor: "pointer",
                  color: isActive ? token.colorPrimary : token.colorText,
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="palette-active"
                    transition={SPRING.snappy}
                    style={{ position: "absolute", inset: 0, borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg }}
                  />
                )}
                <span style={{ position: "relative", display: "inline-flex", fontSize: token.fontSizeLG }}>
                  <Icon />
                </span>
                <span style={{ position: "relative", flex: 1 }}>{command.label}</span>
                {isActive && (
                  <span style={{ position: "relative", display: "inline-flex", color: token.colorTextTertiary }}>
                    <CornerDownLeft />
                  </span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      <Flex
        gap={16}
        wrap
        style={{ padding: "10px 16px", borderTop: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary, fontSize: token.fontSizeSM }}
      >
        <span>
          {kbd(<ArrowUp />)}
          {kbd(<ArrowDown />)} {t("palette.hints.navigate")}
        </span>
        <span>
          {kbd(<CornerDownLeft />)} {t("palette.hints.select")}
        </span>
        <span>
          {kbd("Esc")} {t("palette.hints.close")}
        </span>
      </Flex>
    </div>
  );
}
