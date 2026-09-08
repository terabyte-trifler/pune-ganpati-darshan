'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A small localStorage-backed ordered set, shared across every component
 * that reads the same key.
 *
 * Why not plain useState: favourites and the darshan plan are read by the
 * card, the detail page, the map sheet and the bottom nav simultaneously.
 * A module-level store with `useSyncExternalStore` keeps them consistent
 * without a context provider, and stays correct across tabs.
 *
 * All storage access is guarded: private mode and blocked site data must
 * degrade to in-memory, never throw (§35).
 */

type Listener = () => void;

const stores = new Map<string, Store>();

class Store {
  private items: string[] = [];
  private listeners = new Set<Listener>();
  private loaded = false;
  /** Cached snapshot — useSyncExternalStore requires referential stability. */
  private snapshot: readonly string[] = [];

  constructor(private key: string) {}

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      this.items = Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
      this.items = [];
    }
    this.snapshot = [...this.items];
  }

  private persist() {
    this.snapshot = [...this.items];
    try {
      localStorage.setItem(this.key, JSON.stringify(this.items));
    } catch {
      // Storage unavailable — keep working from memory for this session.
    }
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: Listener) => {
    this.load();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly string[] => {
    this.load();
    return this.snapshot;
  };

  /** The server renders the empty state; the client fills in after mount. */
  getServerSnapshot = (): readonly string[] => EMPTY;

  has = (id: string) => this.getSnapshot().includes(id);

  toggle = (id: string) => {
    this.load();
    const i = this.items.indexOf(id);
    if (i >= 0) this.items.splice(i, 1);
    else this.items.push(id);
    this.persist();
    return this.items.includes(id);
  };

  add = (id: string) => {
    this.load();
    if (!this.items.includes(id)) {
      this.items.push(id);
      this.persist();
    }
  };

  remove = (id: string) => {
    this.load();
    const i = this.items.indexOf(id);
    if (i >= 0) {
      this.items.splice(i, 1);
      this.persist();
    }
  };

  replace = (ids: string[]) => {
    this.load();
    this.items = [...ids];
    this.persist();
  };

  clear = () => this.replace([]);

  /** Cross-tab sync. */
  handleExternalChange = () => {
    this.loaded = false;
    this.load();
    this.listeners.forEach((l) => l());
  };
}

const EMPTY: readonly string[] = [];

function getStore(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = new Store(key);
    stores.set(key, store);
  }
  return store;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key) stores.get(e.key)?.handleExternalChange();
  });
}

/** A store that never emits; used purely to distinguish server from client. */
const subscribeNever = () => () => {};

export function useLocalCollection(key: string) {
  const store = getStore(key);
  const items = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  // Avoids a hydration mismatch: the server always renders the empty state.
  // Done through useSyncExternalStore rather than setState-in-an-effect, so
  // it resolves during hydration instead of causing a second render pass.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  const has = useCallback((id: string) => items.includes(id), [items]);

  return {
    items: items as string[],
    hydrated,
    has,
    toggle: store.toggle,
    add: store.add,
    remove: store.remove,
    replace: store.replace,
    clear: store.clear,
  };
}

export const FAVORITES_KEY = 'pg.favorites';
export const PLAN_KEY = 'pg.plan';

export const useFavorites = () => useLocalCollection(FAVORITES_KEY);
export const usePlan = () => useLocalCollection(PLAN_KEY);
