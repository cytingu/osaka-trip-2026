// 구글맵 공유 링크(maps.app.goo.gl 등)를 풀어서 장소 이름과 좌표를 알려주는 API
// GET /api/resolve?url=<구글맵 링크>  →  { name, lat, lng, final }

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function isShortHost(h) {
  return h === "maps.app.goo.gl" || h === "goo.gl";
}
function isGoogleHost(h) {
  return /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h);
}

export function parseMapsUrl(href) {
  const url = new URL(href);
  let name = null, lat = null, lng = null;

  const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (place) {
    try { name = decodeURIComponent(place[1].replace(/\+/g, " ")); } catch { name = place[1]; }
  }
  // 실제 장소 핀 좌표 (!3d위도!4d경도)
  const pin = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) { lat = +pin[1]; lng = +pin[2]; }

  const q = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("destination");
  if (q) {
    const c = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (c) { if (lat == null) { lat = +c[1]; lng = +c[2]; } }
    else if (!name) name = q;
  }
  // 장소 페이지인데 핀 좌표가 없으면 화면 중심 좌표(@위도,경도)를 사용
  if (lat == null && place) {
    const at = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) { lat = +at[1]; lng = +at[2]; }
  }
  return { name, lat, lng };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "public, s-maxage=86400" : "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const raw = new URL(req.url, "http://localhost").searchParams.get("url") || "";
  let cur;
  try { cur = new URL(raw); } catch { return send(res, 400, { error: "bad_url" }); }
  if (!/^https?:$/.test(cur.protocol)) return send(res, 400, { error: "bad_url" });

  try {
    for (let i = 0; i < 6; i++) {
      const h = cur.hostname;
      if (h === "consent.google.com" && cur.searchParams.get("continue")) {
        cur = new URL(cur.searchParams.get("continue"));
        continue;
      }
      if (isGoogleHost(h)) break;              // 이미 구글맵 주소 → 바로 해석
      if (!isShortHost(h)) return send(res, 400, { error: "not_google_maps" });

      const r = await fetch(cur.href, {
        redirect: "manual",
        headers: { "User-Agent": UA, "Accept-Language": "ko,ja;q=0.8,en;q=0.6" },
      });
      const loc = r.headers.get("location");
      if (loc) { cur = new URL(loc, cur); continue; }
      const body = await r.text();
      const m = body.match(/https:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'\s<>\\]+/);
      if (m) { cur = new URL(m[0].replace(/&amp;/g, "&")); continue; }
      break;
    }
    if (!isGoogleHost(cur.hostname)) return send(res, 422, { error: "unresolved" });
    return send(res, 200, { ...parseMapsUrl(cur.href), final: cur.href });
  } catch (err) {
    return send(res, 502, { error: "resolve_failed", detail: String(err.message || err) });
  }
}
