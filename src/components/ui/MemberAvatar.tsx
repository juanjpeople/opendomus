"use client";

import { theme } from "antd";
import { tint, type AppearanceColor } from "@/lib/appearance";

interface MemberAvatarProps {
  member: { name: string; color: AppearanceColor; emoji?: string };
  size?: number;
}

/** Avatar de un miembro: su emoji (o la inicial) sobre su color. */
export function MemberAvatar({ member, size = 32 }: MemberAvatarProps) {
  const { token } = theme.useToken();
  const palette = tint(token, member.color);

  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: member.emoji ? palette.bg : palette.solid,
        color: token.colorTextLightSolid,
        fontSize: member.emoji ? size * 0.55 : size * 0.45,
        fontWeight: 600,
        lineHeight: 1,
        boxShadow: `0 0 0 2px ${token.colorBgContainer}`,
      }}
    >
      {member.emoji ?? member.name.charAt(0).toUpperCase()}
    </span>
  );
}
