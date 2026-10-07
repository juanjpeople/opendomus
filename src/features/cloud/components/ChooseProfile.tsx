"use client";

import { Button, Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Check, UserPlus } from "lucide-react";
import { useState } from "react";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useT } from "@/i18n";
import type { Member } from "@/features/members/domain";
import { SPRING } from "@/lib/motion";

const NEW = "__new";

/**
 * Al unirse: si la casa ya tenía un perfil para esta persona (el "Adulto" que armó quien la creó,
 * con su historial), puede quedarse con él. Si no, se crea uno con el nombre de su cuenta. Se
 * muestra solo si hay perfiles libres de su rol.
 */
export function ChooseProfile({ candidates, accountName, onChoose }: { candidates: Member[]; accountName: string; onChoose: (memberId: string | null) => Promise<void> }) {
  const t = useT();
  const { token } = theme.useToken();
  const [selected, setSelected] = useState<string>(candidates[0]?.id ?? NEW);
  const [busy, setBusy] = useState(false);

  const options = [
    ...candidates.map((member) => ({ id: member.id, title: member.name, hint: t("cloud.profile.keepHistory"), avatar: <MemberAvatar member={member} size={40} /> })),
    {
      id: NEW,
      title: t("cloud.profile.new"),
      hint: t("cloud.profile.newHint", { name: accountName }),
      avatar: (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: token.colorFillSecondary, color: token.colorTextSecondary }}>
          <UserPlus />
        </span>
      ),
    },
  ];

  return (
    <Flex vertical gap={18}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("cloud.profile.title")}
        </Typography.Title>
        <Typography.Text type="secondary">{t("cloud.profile.text")}</Typography.Text>
      </div>
      <Flex vertical gap={10} role="radiogroup" aria-label={t("cloud.profile.title")}>
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <motion.button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(option.id)}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
                borderRadius: token.borderRadiusLG,
                border: `1.5px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
                background: active ? token.colorPrimaryBg : token.colorBgContainer,
              }}
            >
              {option.avatar}
              <span style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong style={{ display: "block" }}>
                  {option.title}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {option.hint}
                </Typography.Text>
              </span>
              {active && <Check color={token.colorPrimary} />}
            </motion.button>
          );
        })}
      </Flex>
      <Button
        type="primary"
        size="large"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await onChoose(selected === NEW ? null : selected);
          setBusy(false);
        }}
      >
        {t("cloud.profile.continue")}
      </Button>
    </Flex>
  );
}
