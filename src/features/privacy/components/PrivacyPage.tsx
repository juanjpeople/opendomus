"use client";

import { Avatar, Card, Col, Flex, Row, Skeleton, Tag, Tooltip, Typography, theme } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, ChefHat, HardHat, KeyRound, ShoppingCart, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { IconTile, ListRow, PageHeader, PRIVACY_META } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { Member } from "@/features/members/domain";
import { useMembers } from "@/features/members/hooks";
import { HOME_LIST_ID } from "@/features/shopping/domain";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { projectHref, recipeHref } from "@/lib/navigation/routes";
import { canSee, isPrivacy, PRIVACY_LEVELS, type Privacy, type Viewer } from "@/lib/sync/scope";
import { useDeviceStore } from "@/store/useDeviceStore";

type ItemType = "list" | "project" | "recipe" | "event";

const TYPE_ICONS: Record<ItemType, LucideIcon> = { list: ShoppingCart, project: HardHat, recipe: ChefHat, event: CalendarDays };

interface PrivacyItem {
  id: string;
  name: string;
  type: ItemType;
  privacy: Privacy;
  createdBy: string;
  href: string;
}

const levelOf = (value: unknown): Privacy => (isPrivacy(value) ? value : "family");

/** Quiénes de la casa ven un nivel (en Privado, solo quien mira: es lo suyo). */
function audience(level: Privacy, members: Member[], viewer: Viewer | null): Member[] {
  if (level === "family") return members;
  if (level === "adults") return members.filter((member) => member.role !== "kid");
  return members.filter((member) => member.id === viewer?.id);
}

/**
 * Qué se comparte con quién: los tres niveles, quiénes ven cada uno y qué hay en cada uno (solo
 * lo que este perfil puede ver). Se cambia al crear o editar cada cosa.
 */
export function PrivacyPage() {
  const t = useT();
  const { token } = theme.useToken();
  const viewer = useCurrentUser();
  const members = useMembers() ?? [];
  const cloud = useDeviceStore((s) => s.mode) === "cloud";
  const hiddenFromKid = viewer?.role === "kid";
  const items = useLiveQuery(async (): Promise<PrivacyItem[]> => {
    const [lists, projects, recipes, events] = await Promise.all([db.shoppingLists.toArray(), db.projects.toArray(), db.recipes.toArray(), db.events.toArray()]);
    return [
      ...lists.map((item) => ({
        id: item.id,
        name: item.id === HOME_LIST_ID ? t("shopping.lists.home") : item.name,
        type: "list" as const,
        privacy: levelOf(item.privacy),
        createdBy: item.createdBy,
        href: item.id === HOME_LIST_ID ? "/compras" : `/compras?lista=${item.id}`,
      })),
      ...projects.map((item) => ({ id: item.id, name: item.name, type: "project" as const, privacy: levelOf(item.privacy), createdBy: item.createdBy, href: projectHref(item.id) })),
      ...recipes.map((item) => ({ id: item.id, name: item.name, type: "recipe" as const, privacy: levelOf(item.privacy), createdBy: item.createdBy, href: recipeHref(item.id) })),
      ...events.map((item) => ({ id: item.id, name: item.title, type: "event" as const, privacy: levelOf(item.privacy), createdBy: item.createdBy, href: "/calendario" })),
    ]
      .filter((item) => canSee(viewer, item))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [viewer?.id, viewer?.role, t]);

  return (
    <>
      <PageHeader eyebrow={t("privacy.page.eyebrow")} title={t("privacy.page.title")} description={t("privacy.page.description")} />

      <Reveal>
        <Flex
          gap={14}
          align="flex-start"
          style={{ padding: 16, marginBottom: 20, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}
        >
          <IconTile icon={KeyRound} color="green" size={44} />
          <Flex vertical gap={4} style={{ minWidth: 0 }}>
            <Typography.Text strong>{cloud ? t("privacy.page.cloudTitle") : t("privacy.page.localTitle")}</Typography.Text>
            <Typography.Text type="secondary">{cloud ? t("privacy.page.cloudNote") : t("privacy.page.localNote")}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("privacy.page.howTo")}
            </Typography.Text>
          </Flex>
        </Flex>
      </Reveal>

      {items === undefined ? (
        <Skeleton active />
      ) : (
        <Stagger stagger={0.06}>
          <Row gutter={[16, 16]}>
            {PRIVACY_LEVELS.map((level) => {
              const { icon, color } = PRIVACY_META[level];
              const palette = tint(token, color);
              const own = items.filter((item) => item.privacy === level);
              const who = audience(level, members, viewer);
              return (
                <Col xs={24} lg={8} key={level}>
                  <StaggerItem style={{ height: "100%" }}>
                    <Card style={{ height: "100%", borderTop: `3px solid ${palette.solid}` }} styles={{ body: { display: "flex", flexDirection: "column", gap: 16 } }}>
                      <div>
                        <Flex align="center" gap={12} style={{ marginBottom: 10 }}>
                          <IconTile icon={icon} color={color} size={40} />
                          <Typography.Title level={5} style={{ margin: 0, flex: 1, minWidth: 0 }}>
                            {t(`privacy.levels.${level}.label`)}
                          </Typography.Title>
                          {!(hiddenFromKid && level === "adults") && (
                            <Tag color={color} style={{ margin: 0 }}>
                              {own.length}
                            </Tag>
                          )}
                        </Flex>
                        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                          {t(`privacy.levels.${level}.description`)}
                        </Typography.Text>
                      </div>

                      <div>
                        <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM, marginBottom: 6 }}>
                          {t("privacy.page.whoSees")}
                        </Typography.Text>
                        <Flex align="center" gap={8} wrap>
                          <Avatar.Group max={{ count: 6 }}>
                            {who.map((member) => (
                              <Tooltip key={member.id} title={`${member.name} · ${t(`roles.${member.role}`)}`}>
                                <span style={{ display: "inline-flex" }}>
                                  <MemberAvatar member={member} size={30} />
                                </span>
                              </Tooltip>
                            ))}
                          </Avatar.Group>
                          {level === "private" && <Typography.Text type="secondary">{t("privacy.page.onlyYou")}</Typography.Text>}
                        </Flex>
                      </div>

                      <Flex vertical gap={2} style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12 }}>
                        {own.length === 0 ? (
                          <Typography.Text type="secondary" style={{ paddingBlock: 6 }}>
                            {/* Un chico no ve lo de Adultos: decir "no hay nada" sería mentirle. */}
                            {hiddenFromKid && level === "adults" ? t("privacy.page.adultsOnly") : t("privacy.page.empty")}
                          </Typography.Text>
                        ) : (
                          own.map((item) => {
                            const TypeIcon = TYPE_ICONS[item.type];
                            return (
                              <ListRow key={`${item.type}-${item.id}`} href={item.href} title={item.name} wrapTitle
                                leading={<span style={{ display: "inline-flex", color: token.colorTextSecondary, fontSize: token.fontSize }} aria-hidden><TypeIcon /></span>}
                                meta={t(`privacy.page.types.${item.type}`)} />
                            );
                          })
                        )}
                      </Flex>
                    </Card>
                  </StaggerItem>
                </Col>
              );
            })}
          </Row>
        </Stagger>
      )}
    </>
  );
}
