const PREFIX = "visibilityos_";

export function ssGet(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function ssSet(key: string, value: string): void {
  try { localStorage.setItem(PREFIX + key, value); } catch {}
}

export function ssParse<T>(key: string): T | null {
  const raw = ssGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function ssStringify(key: string, value: unknown): void {
  ssSet(key, JSON.stringify(value));
}
