// Cache mémoire LRU minimal pour les lectures read-mostly (Etablissement,
// ConfigNotes, Matieres, Niveau). Volontairement sans dépendance externe.
// TTL court (5 min) + invalidation explicite via `invalidate(key)`.

type Entry<V> = { value: V; expiresAt: number };

export class LruCache<K, V> {
  private store = new Map<K, Entry<V>>();

  constructor(
    private readonly maxSize: number = 200,
    private readonly ttlMs: number = 5 * 60 * 1000,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // LRU : refresh order on access
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    else if (this.store.size >= this.maxSize) {
      // Évince le plus ancien (premier inséré)
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  async getOrLoad(key: K, loader: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value);
    return value;
  }
}

// Caches partagés — clé = `etablissement_id` ou `etablissement_id:periode`.
export const etablissementCache = new LruCache<string, unknown>(200, 5 * 60 * 1000);
export const configNotesCache  = new LruCache<string, unknown>(200, 5 * 60 * 1000);
export const matieresCache     = new LruCache<string, unknown>(200, 5 * 60 * 1000);
export const niveauxCache      = new LruCache<string, unknown>(200, 5 * 60 * 1000);

export function invalidateEtablissement(etablissement_id: string): void {
  etablissementCache.invalidate(etablissement_id);
  configNotesCache.invalidate(etablissement_id);
  matieresCache.invalidate(etablissement_id);
  niveauxCache.invalidate(etablissement_id);
}
