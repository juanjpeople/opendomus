"use client";

import { Button, Flex, theme } from "antd";
import { motion, useAnimationControls } from "framer-motion";
import { Check, Delete } from "lucide-react";
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";

export interface PinPadHandle {
  /** Sacude y limpia (PIN incorrecto). */
  reject: () => void;
  clear: () => void;
}

interface PinPadProps {
  onSubmit: (pin: string) => void;
  maxLength?: number;
  minLength?: number;
  disabled?: boolean;
  ref?: Ref<PinPadHandle>;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Teclado de PIN: botones grandes (también para chicos) y teclado físico.
 * No envía solo al llegar a N dígitos: el largo del PIN no se guarda en ningún lado.
 */
export function PinPad({ onSubmit, maxLength = 8, minLength = 4, disabled = false, ref }: PinPadProps) {
  const { token } = theme.useToken();
  const t = useT();
  const [pin, setPin] = useState("");
  const controls = useAnimationControls();

  useImperativeHandle(ref, () => ({
    reject: () => {
      setPin("");
      controls.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.4 } });
    },
    clear: () => setPin(""),
  }));

  const press = (digit: string) => !disabled && setPin((current) => (current.length < maxLength ? current + digit : current));
  const erase = () => setPin((current) => current.slice(0, -1));
  const submit = () => pin.length >= minLength && !disabled && onSubmit(pin);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") erase();
      else if (event.key === "Enter") submit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const key = (content: React.ReactNode, onClick: () => void, label: string, primary = false) => (
    <motion.div key={label} whileTap={{ scale: 0.92 }} transition={SPRING.snappy}>
      <Button
        shape="circle"
        type={primary ? "primary" : "default"}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        style={{ width: 64, height: 64, fontSize: token.fontSizeXL, fontWeight: 600 }}
      >
        {content}
      </Button>
    </motion.div>
  );

  return (
    <Flex vertical align="center" gap={20}>
      <motion.div animate={controls}>
        <Flex gap={12} style={{ height: 16 }} aria-live="polite" aria-label={`${pin.length}`}>
          {Array.from({ length: Math.max(minLength, pin.length) }, (_, index) => (
            <motion.span
              key={index}
              initial={false}
              animate={{ scale: index < pin.length ? 1 : 0.6, backgroundColor: index < pin.length ? token.colorPrimary : token.colorFillSecondary }}
              transition={SPRING.snappy}
              style={{ width: 14, height: 14, borderRadius: "50%", display: "block" }}
            />
          ))}
        </Flex>
      </motion.div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 14 }}>
        {KEYS.map((digit) => key(digit, () => press(digit), digit))}
        {key(<Delete />, erase, t("lock.erase"))}
        {key("0", () => press("0"), "0")}
        {key(<Check />, submit, "OK", true)}
      </div>
    </Flex>
  );
}
