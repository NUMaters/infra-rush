type OutboxItem = { id: string };

export function apiEndpoint(path: string): string | null {
  const configured = import.meta.env.VITE_ONLINE_WS_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!["ws:", "wss:"].includes(url.protocol)) return null;
      if (location.protocol === "https:" && url.protocol !== "wss:")
        return null;
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      url.pathname = path;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }
  if (location.hostname.endsWith(".github.io")) return null;
  const host = ["5173", "5177", "5178"].includes(location.port)
    ? `${location.hostname}:8080`
    : location.host;
  return `${location.protocol}//${host}${path}`;
}

export function createOutbox<T extends OutboxItem>(key: string, path: string) {
  let flushing: Promise<boolean> | null = null;
  function read(): T[] {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value.slice(-20) : [];
    } catch {
      return [];
    }
  }
  function save(items: T[]): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(items.slice(-20)));
      return true;
    } catch {
      return false;
    }
  }
  async function send(): Promise<boolean> {
    const endpoint = apiEndpoint(path);
    if (!endpoint) return false;
    for (const item of read()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
          keepalive: true,
          signal: controller.signal,
        });
        if (!response.ok) return false;
        save(read().filter((queued) => queued.id !== item.id));
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    }
    return true;
  }
  function flush(): Promise<boolean> {
    if (!flushing) {
      flushing = send().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }
  async function submit(item: T): Promise<boolean> {
    const queued = read();
    if (!queued.some((entry) => entry.id === item.id)) {
      queued.push(item);
      if (!save(queued)) return false;
    }
    const sent = await flush();
    if (!sent) return false;
    return read().some((entry) => entry.id === item.id) ? flush() : true;
  }
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
  return { submit, flush };
}
