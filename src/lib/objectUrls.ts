/**
 * URLs de Blobs locales (`blob:…`) para mostrar fotos guardadas en IndexedDB, con caché por clave.
 *
 * - La misma clave da siempre la misma URL, aunque llegue otra instancia del Blob (cada consulta
 *   reactiva devuelve una nueva): la imagen no parpadea ni se vuelve a decodificar.
 * - Se cuentan los usos y se libera un rato después del último: si React desmonta y vuelve a montar
 *   enseguida (StrictMode, navegar entre páginas), la URL sigue viva.
 * - Las claves tienen que identificar un contenido que no cambia (ej. el id de una foto).
 */
const RELEASE_DELAY_MS = 5_000;

interface Entry {
  url: string;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}

const cache = new Map<string, Entry>();

function scheduleRelease(key: string, entry: Entry) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (entry.refs > 0) return;
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }, RELEASE_DELAY_MS);
}

/** URL para un Blob. Si nadie la retiene (ver `retainObjectUrl`), se libera sola. */
export function objectUrlFor(key: string, blob: Blob): string {
  let entry = cache.get(key);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), refs: 0 };
    cache.set(key, entry);
    scheduleRelease(key, entry);
  }
  return entry.url;
}

/** Marca la URL como en uso. Devuelve la función que la suelta (para la limpieza del efecto). */
export function retainObjectUrl(key: string): () => void {
  const entry = cache.get(key);
  if (!entry) return () => {};
  entry.refs++;
  clearTimeout(entry.timer);
  return () => {
    entry.refs--;
    if (entry.refs <= 0) scheduleRelease(key, entry);
  };
}
