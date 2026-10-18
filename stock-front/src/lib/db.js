import Dexie from "dexie";

// Base IndexedDB locale : bien plus de place que localStorage (~5 Mo),
// ce qui permet de tenir plusieurs semaines de ventes sans réseau.
const db = new Dexie("dymStock");
db.version(1).stores({ kv: "" });

export async function readValue(key) {
  try {
    return await db.kv.get(key);
  } catch {
    return undefined;
  }
}

export async function writeValue(key, value) {
  await db.kv.put(value, key);
}

/** Demande au navigateur de ne pas purger nos données en cas de manque d'espace. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // non supporté : les données restent en stockage « best effort »
  }
}
