/** Búsqueda tolerante a acentos y espacios, sin modificar los textos guardados. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Tramos para resaltar todas las palabras sin perder tildes, espacios ni caracteres Unicode. */
export function highlightSearch(text: string, query: string): { text: string; matched: boolean }[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return [{ text, matched: false }];
  let folded = "", offset = 0;
  const starts: number[] = [], ends: number[] = [];
  for (const char of text) {
    const normalized = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (let i = 0; i < normalized.length; i++) { starts.push(offset); ends.push(offset + char.length); }
    // Un acento descompuesto pertenece al carácter anterior.
    if (!normalized && ends.length) ends[ends.length - 1] = offset + char.length;
    folded += normalized;
    offset += char.length;
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) {
      marked.fill(true, starts[at], ends[at + term.length - 1]);
    }
  }
  const parts: { text: string; matched: boolean }[] = [];
  for (let start = 0; start < text.length;) {
    let end = start + 1;
    while (end < text.length && marked[end] === marked[start]) end++;
    parts.push({ text: text.slice(start, end), matched: marked[start] });
    start = end;
  }
  return parts;
}
