"use client";

import { Card, Col, Empty, Flex, List, Row, Skeleton, Tag, Typography } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { LockKeyhole, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { HOME_LIST_ID } from "@/features/shopping/domain";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { projectHref, recipeHref } from "@/lib/navigation/routes";
import { canSee, isPrivacy, PRIVACY_LEVELS, type Privacy } from "@/lib/sync/scope";

const ICONS = {
  family: Users,
  adults: ShieldCheck,
  private: LockKeyhole,
} satisfies Record<Privacy, typeof Users>;

interface PrivacyItem {
  id: string;
  name: string;
  type: "list" | "project" | "recipe" | "event";
  privacy: Privacy;
  createdBy: string;
  href: string;
}

export function PrivacyPage() {
  const t = useT();
  const viewer = useCurrentUser();
  const items = useLiveQuery(async (): Promise<PrivacyItem[]> => {
    const [lists, projects, recipes, events] = await Promise.all([
      db.shoppingLists.toArray(),
      db.projects.toArray(),
      db.recipes.toArray(),
      db.events.toArray(),
    ]);
    return [
      ...lists.map((item) => ({ id: item.id, name: item.id === HOME_LIST_ID ? t("shopping.lists.home") : item.name, type: "list" as const, privacy: levelOf(item.privacy), createdBy: item.createdBy, href: "/compras" })),
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
      {items === undefined ? (
        <Skeleton active />
      ) : (
        <Row gutter={[16, 16]}>
          {PRIVACY_LEVELS.map((level) => {
            const Icon = ICONS[level];
            const own = items.filter((item) => item.privacy === level);
            return (
              <Col xs={24} lg={8} key={level}>
                <Card
                  style={{ height: "100%" }}
                  title={
                    <Flex align="center" gap={8}>
                      <Icon size={20} />
                      {t(`privacy.levels.${level}.label`)}
                    </Flex>
                  }
                >
                  <Typography.Paragraph type="secondary">{t(`privacy.levels.${level}.description`)}</Typography.Paragraph>
                  {own.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("privacy.page.empty")} />
                  ) : (
                    <List
                      size="small"
                      dataSource={own}
                      renderItem={(item) => (
                        <List.Item extra={<Tag>{t(`privacy.page.types.${item.type}`)}</Tag>}>
                          <Link href={item.href}>{item.name}</Link>
                        </List.Item>
                      )}
                    />
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
}

const levelOf = (value: unknown): Privacy => (isPrivacy(value) ? value : "family");
