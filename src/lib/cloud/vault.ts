/**
 * Llavero del dispositivo: la identidad de la persona (claves privadas) en IndexedDB, como
 * CryptoKey NO exportables. Se pueden usar para abrir sobres y firmar, pero ningún script
 * puede leerlas ni mandarlas a otro lado. Así un dispositivo de confianza no pide la
 * contraseña cada vez. "Salir" lo borra.
 *
 * Las claves de nivel (Familia, Adultos…) no se guardan acá: se abren de sus sobres cuando
 * hacen falta, con esta identidad.
 */
import Dexie, { type EntityTable } from "dexie";
import type { Identity } from "@/lib/crypto";

export interface VaultEntry {
  userId: string;
  email: string;
  identity: Identity;
  savedAt: number;
}

const vault = new Dexie("RefugioVault") as Dexie & { identities: EntityTable<VaultEntry, "userId"> };
vault.version(1).stores({ identities: "userId" });

export async function saveIdentity(entry: VaultEntry) {
  await vault.identities.put(entry);
}

export async function loadIdentity(userId: string): Promise<VaultEntry | undefined> {
  return vault.identities.get(userId);
}

export async function clearVault() {
  await vault.identities.clear();
}
