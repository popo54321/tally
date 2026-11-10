// Where saved data physically lives: the browser's local storage, or (when the app runs inside a host
// that provides one) its window.storage. Every read and write in the app goes through here.

export interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
  /** Removes a key. Hosts without a delete store an empty string, which every reader treats as absent. */
  remove(k: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

interface HostStorage {
  get(k: string): Promise<{ value?: string } | null>;
  set(k: string, v: string): Promise<unknown>;
  delete?(k: string): Promise<unknown>;
  list(p: string): Promise<{ keys?: string[] } | null>;
}

const host = (typeof window !== 'undefined') ? (window as unknown as { storage?: HostStorage }).storage : undefined;
export const hasHostStorage = !!host && typeof host.get === 'function';

export const STORE: KV = hasHostStorage ? {
  async get(k) { const r = await host!.get(k); return (r && 'value' in r) ? (r.value as string) : null; },
  async set(k, v) { await host!.set(k, v); },
  async remove(k) { if (typeof host!.delete === 'function') await host!.delete(k); else await host!.set(k, ''); },
  async list(p) { const r = await host!.list(p); return (r && r.keys) ? r.keys : []; },
} : {
  async get(k) { return localStorage.getItem(k); },
  async set(k, v) { localStorage.setItem(k, v); },
  async remove(k) { localStorage.removeItem(k); },
  async list(p) { const out: string[] = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) as string; if (!p || k.indexOf(p) === 0) out.push(k); } return out; },
};
