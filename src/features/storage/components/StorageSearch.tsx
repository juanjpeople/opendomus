"use client";

import { Button, Card, Empty, Input, Skeleton, Typography } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref } from "@/lib/navigation/routes";
import { normalizeSearch } from "@/lib/search";
import { indexStorage, searchStorage } from "../search";
import { ContainerScene } from "./ContainerScene";

export function StorageSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const deferred = useDeferredValue(query);
  const index = useLiveQuery(async () => {
    const [spaces, containers, items, notes] = await Promise.all([db.spaces.toArray(), db.containers.orderBy("name").toArray(), db.inventory.toArray(), db.containerContents.toArray()]);
    return indexStorage(spaces, containers, items, notes);
  });
  const results = index ? searchStorage(index, deferred) : undefined;
  const terms = normalizeSearch(deferred).split(" ").filter(Boolean);
  return <Card style={{ marginBottom: 24 }}>
    <Input size="large" prefix={<Search />} placeholder={t("storage.search.placeholder")} aria-label={t("storage.search.placeholder")} value={query} allowClear onChange={(event) => { setQuery(event.target.value); setLimit(12); }} />
    {!query.trim() && <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>{t("storage.search.hint")}</Typography.Paragraph>}
    {query.trim() && <div aria-live="polite" aria-busy={query !== deferred}>
      {!results && <Skeleton active />}
      {results?.length === 0 && <Empty description={t("storage.search.empty")} />}
      {!!results?.length && <>
        <Typography.Paragraph type="secondary" style={{ margin: "12px 0" }}>{t("storage.search.count", { count: results.length })}</Typography.Paragraph>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {results.slice(0, limit).map((entry) => {
            const matched = entry.contents.filter((text) => terms.some((term) => normalizeSearch(text).includes(term)));
            return <li key={entry.container.id}><Link href={containerHref(entry.container.id)} style={{ display: "flex", gap: 16, alignItems: "center", color: "inherit" }}>
              <ContainerScene container={entry.container} compact />
              <div style={{ minWidth: 0 }}><Typography.Text strong style={{ overflowWrap: "anywhere" }}>{entry.path}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ margin: "4px 0", overflowWrap: "anywhere" }}>{(matched.length ? matched : entry.contents).slice(0, 3).join(" · ")}</Typography.Paragraph>
                <Typography.Text type="secondary">{t("storage.code")} {entry.container.code}</Typography.Text>
              </div>
            </Link></li>;
          })}
        </ul>
        {results.length > limit && <Button onClick={() => setLimit((current) => current + 12)} style={{ marginTop: 16 }}>{t("storage.search.more")}</Button>}
      </>}
    </div>}
  </Card>;
}
