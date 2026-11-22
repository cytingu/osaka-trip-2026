// 오사카 여행 일정 저장 API (Vercel Function)
// 저장소: Vercel Marketplace의 Upstash Redis
// 필요한 환경 변수(연결하면 Vercel이 자동으로 넣어 줌):
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   (또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)

const KEY = "osaka-2026:itinerary";
const FIELDS = [
  "theme",
  "breakfast", "breakfast_alt", "breakfast_cost",
  "lunch", "lunch_alt", "lunch_cost",
  "dinner", "dinner_alt", "dinner_cost",
  "place1", "place2", "free", "place_cost",
  "reserve", "notes", "memo",
  "done", "cost",
];
const FIELD_RE = new RegExp(`^d([1-9]):(${FIELDS.join("|")})$`);
const MAX_LEN = 2000;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cfg, command) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Redis HTTP ${res.status}`);
  return data.result;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const cfg = redisConfig();
  if (!cfg) {
    return send(res, 503, { error: "storage_not_connected" });
  }

  try {
    if (req.method === "GET") {
      const flat = (await redis(cfg, ["HGETALL", KEY])) || [];
      const values = {};
      for (let i = 0; i < flat.length; i += 2) values[flat[i]] = flat[i + 1];
      return send(res, 200, { values });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const changes = body && typeof body.changes === "object" ? body.changes : null;
      if (!changes) return send(res, 400, { error: "changes 필요" });

      const args = [];
      for (const [k, v] of Object.entries(changes)) {
        if (!FIELD_RE.test(k)) return send(res, 400, { error: `알 수 없는 항목: ${k}` });
        const s = String(v ?? "");
        if (s.length > MAX_LEN) return send(res, 400, { error: `${k} 내용이 너무 길어요` });
        args.push(k, s);
      }
      if (args.length === 0) return send(res, 200, { ok: true });
      // 항목별로 따로 저장하므로 두 사람이 다른 칸을 동시에 고쳐도 서로 덮어쓰지 않음
      await redis(cfg, ["HSET", KEY, ...args]);
      return send(res, 200, { ok: true, saved: args.length / 2 });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (err) {
    return send(res, 500, { error: "server_error", detail: String(err.message || err) });
  }
}
