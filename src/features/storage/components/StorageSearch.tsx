"use client";

import { Button, Card, Flex, Input, Typography, theme } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, SearchX } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useDeferredValue, useState, type ReactNode } from "react";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref } from "@/lib/navigation/routes";
import { highlightSearch, normalizeSearch } from "@/lib/search";
import { EmptyState, IconTile, ListRow, LoadingSkeleton } from "@/components/ui";
import { containerAppearance } from "../domain";
import { indexStorage, matchedItem, searchStorage } from "../search";

function Highlight({ text, query }: { text: string; query: string }) {
  return highlightSearch(text, query).map((part, index) => part.matched ? <Typography.Text mark key={index}>{part.text}</Typography.Text> : part.text);
}

/**
 * Buscador de Inventario en una sola línea: la ayuda va en el título del campo y los resultados
 * aparecen debajo solo cuando hay algo escrito. `extra` queda a la derecha (ej. el menú "Vista").
 */
export function StorageSearch({ extra }: { extra?: ReactNode }) {
  const t = useT();
  const { token } = theme.useToken();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const deferred = useDeferredValue(query);
  const index = useLiveQuery(async () => {
    const [spaces, containers, items, notes] = await Promise.all([db.spaces.toArray(), db.containers.orderBy("name").toArray(), db.inventory.toArray(), db.containerContents.toArray()]);
    return indexStorage(spaces, containers, items, notes);
  });
  const results = index ? searchStorage(index, deferred) : undefined;
  const terms = normalizeSearch(deferred).split(" ").filter(Boolean);
  return <div style={{ marginBottom: token.marginLG }}>
    <Flex gap={token.marginXS} align="center">
      <Input prefix={<Search />} placeholder={t("storage.search.placeholder")} aria-label={t("storage.search.placeholder")} title={t("storage.search.hint")} value={query} allowClear
        onChange={(event) => { setQuery(event.target.value); setLimit(12); }} style={{ flex: 1, minWidth: 0, minHeight: token.controlHeightLG }} />
      {extra}
    </Flex>
    <div aria-live="polite" aria-busy={query !== deferred}>
    {query.trim() && <Card style={{ marginTop: token.marginXS }}>
      {!results && <LoadingSkeleton />}
      {results?.length === 0 && <EmptyState icon={SearchX} title={t("storage.search.empty")} />}
      {!!results?.length && <>
        <Typography.Paragraph type="secondary" style={{ margin: `0 0 ${token.marginSM}px` }}>{t("storage.search.count", { count: results.length })}</Typography.Paragraph>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <AnimatePresence initial={false}>{results.slice(0, limit).map((entry, index) => {
            const matched = entry.contents.filter((text) => terms.some((term) => normalizeSearch(text).includes(term)));
            const item = matchedItem(entry, deferred);
            const { color, Icon } = containerAppearance(entry.container);
            return <li key={entry.container.id}><ListRow index={index} divider={index < Math.min(results.length, limit) - 1}
              href={containerHref(entry.container.id, { item: item?.id })} openLabel={item ? t("storage.search.openItem", { name: item.name, place: entry.path }) : entry.path}
              leading={<IconTile icon={Icon} color={color} size={token.controlHeight} />}
              title={<Highlight text={item?.name ?? matched[0] ?? entry.container.name} query={deferred} />}
              meta={<><span style={{ overflowWrap: "anywhere" }}><Highlight text={entry.path} query={deferred} /></span><span style={{ fontFamily: "var(--font-geist-mono)", color: token.colorTextTertiary }}>{t("storage.code")} <Highlight text={entry.container.code} query={deferred} /></span></>} />
            </li>;
          })}</AnimatePresence>
        </ul>
        {results.length > limit && <Button onClick={() => setLimit((current) => current + 12)} style={{ marginTop: 16 }}>{t("storage.search.more")}</Button>}
      </>}
    </Card>}
    </div>
  </div>;
}
