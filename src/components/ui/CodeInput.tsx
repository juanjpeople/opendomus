"use client";

import { Input } from "antd";
import { useEffect, useRef, useState } from "react";
import type { OTPRef } from "antd/es/input/OTP";

/**
 * Un código de verificación de 6 números (app autenticadora): una casilla por número, pegar el
 * código completo funciona y al completarlo se envía solo. El teclado del teléfono es el numérico
 * y el sistema puede sugerir el código (`one-time-code`).
 */
export function CodeInput({ onComplete, disabled = false, autoFocus = true, label, length = 6 }: {
  onComplete: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Nombre para lectores de pantalla (el label visible va en el Form.Item). */
  label: string;
  length?: number;
}) {
  const ref = useRef<OTPRef>(null);
  const [value, setValue] = useState("");
  // Después de un código incorrecto (vuelve a habilitarse), queda vacío y listo para escribir.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (wasDisabled !== disabled) {
    setWasDisabled(disabled);
    if (!disabled) setValue("");
  }
  useEffect(() => {
    if (!disabled && autoFocus) ref.current?.focus();
  }, [disabled, autoFocus]);
  return (
    <Input.OTP
      ref={ref}
      aria-label={label}
      length={length}
      size="large"
      value={value}
      disabled={disabled}
      autoComplete="one-time-code"
      inputMode="numeric"
      formatter={(next) => next.replace(/\D/g, "")}
      onChange={(next) => {
        setValue(next);
        if (next.length === length) onComplete(next);
      }}
    />
  );
}
