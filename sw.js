/* 오프라인 실행용 서비스 워커.
   뷰어 프로그램 파일(HTML·JS·CSS)만 기기에 보관한다. 콘티·악보·필기 데이터는 다루지 않는다. */
const CACHE = "wset-viewer-v2";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch("./", { cache: "no-cache" });
    const html = await res.clone().text();
    await cache.put("./", res);
    // 프로그램 파일 전체(글꼴·PDF 처리 파일 포함)를 미리 받아 둔다.
    let urls = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
    try {
      const list = await (await fetch("./precache.json", { cache: "no-cache" })).json();
      urls = urls.concat(list.map((f) => "./" + f));
    } catch (err) { /* 목록이 없으면 index.html 이 가리키는 파일만 보관 */ }
    await Promise.all([...new Set(urls)].map((u) => cache.add(u).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isPage = req.mode === "navigate";
    try {
      // 온라인이면 새 버전을 받아 보관하고, 실패하면 보관해 둔 파일을 쓴다.
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(isPage ? "./" : req, fresh.clone());
      return fresh;
    } catch (err) {
      const cached = await cache.match(isPage ? "./" : req);
      if (cached) return cached;
      throw err;
    }
  })());
});
