"use client";

import { App, Button, Flex, Form, Input, Typography } from "antd";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CodeInput, PanelHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { getErrorMessage } from "@/lib/errors";
import type { SecondStepProof } from "../domain";
import { passkeysSupported, verifySecondStep } from "../service";

/**
 * El segundo paso del ingreso: el código de la app autenticadora, una llave de acceso o un código
 * de respaldo. `onVerified` sigue con lo que falte (abrir las claves con la contraseña ya escrita).
 */
export function SecondStepForm({ onVerified }: { onVerified: () => Promise<unknown> | void }) {
  const t = useT();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState(false);

  async function verify(proof: SecondStepProof) {
    setBusy(true);
    try {
      await verifySecondStep(proof);
      await onVerified();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex vertical gap={20}>
      <PanelHeader icon={ShieldCheck} title={t("cloud.twoFactor.title")} description={backup ? t("cloud.twoFactor.stepBackupHint") : t("cloud.twoFactor.stepText")} />
      {backup ? (
        <Form layout="vertical" requiredMark={false} disabled={busy} onFinish={({ code }: { code: string }) => void verify({ kind: "backup", code })}>
          <Form.Item name="code" label={t("cloud.twoFactor.stepBackupLabel")} rules={[{ required: true, whitespace: true, message: t("cloud.twoFactor.stepBackupLabel") }]}>
            <Input size="large" autoComplete="off" spellCheck={false} autoFocus />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={busy}>
            {t("cloud.twoFactor.stepVerify")}
          </Button>
        </Form>
      ) : (
        <Flex justify="center">
          <CodeInput label={t("cloud.twoFactor.confirmLabel")} disabled={busy} onComplete={(code) => void verify({ kind: "code", code })} />
        </Flex>
      )}
      {passkeysSupported() && (
        <Button size="large" block icon={<Fingerprint />} disabled={busy} onClick={() => void verify({ kind: "passkey" })}>
          {t("cloud.twoFactor.stepPasskey")}
        </Button>
      )}
      <Typography.Link onClick={() => !busy && setBackup((current) => !current)} style={{ alignSelf: "center" }}>
        {backup ? t("cloud.twoFactor.stepUseCode") : t("cloud.twoFactor.stepUseBackup")}
      </Typography.Link>
    </Flex>
  );
}
