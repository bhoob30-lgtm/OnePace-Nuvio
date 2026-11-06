// One Pace – addon Stremio/Nuvio con streaming diretto (HTTP) da Pixeldrain, niente torrent/p2p.
// Funziona come server Node (npm start) oppure come funzione serverless (Vercel, vedi api/index.js).
const ARCS = require("./arcs.json");

const PIXELDRAIN = process.env.PIXELDRAIN_URL || "https://pixeldrain.com";
const CACHE_MS = 60 * 60 * 1000; // 1 ora
const SERIES_ID = "onepace";

const manifest = {
  id: "community.onepace.direct",
  version: "1.1.0",
  name: "One Pace (HTTP)",
  description: "One Pace in streaming diretto da Pixeldrain, senza torrent.",
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  idPrefixes: [SERIES_ID],
  catalogs: [{ type: "series", id: "onepace", name: "One Pace" }],
  behaviorHints: { configurable: false },
};

// Immagini della serie. Puoi sostituirle con qualsiasi URL diretto a un'immagine
// (oppure impostare le variabili d'ambiente POSTER_URL, BACKGROUND_URL, LOGO_URL).
const IMDB_ID = "tt0388629"; // One Piece, usato solo per prendere le immagini
const POSTER = process.env.POSTER_URL || `https://images.metahub.space/poster/medium/${IMDB_ID}/img`;
const BACKGROUND = process.env.BACKGROUND_URL || `https://images.metahub.space/background/medium/${IMDB_ID}/img`;
const LOGO = process.env.LOGO_URL || `https://images.metahub.space/logo/medium/${IMDB_ID}/img`;

const cache = { at: 0, data: null, pending: null };

async function fetchList(listId) {
  const res = await fetch(`${PIXELDRAIN}/api/list/${listId}`, { headers: { "User-Agent": "onepace-addon" } });
  if (!res.ok) throw new Error(`Pixeldrain list ${listId}: HTTP ${res.status}`);
  const json = await res.json();
  return json.files || [];
}

// Esempio nome file: "[One Pace][1-7] Romance Dawn 01 [1080p][En Sub][ABCD1234].mkv"
function parseFile(file) {
  const name = file.name.replace(/\.[a-z0-9]+$/i, "");
  const tags = [...name.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const quality = tags.find((t) => /^\d{3,4}p$/i.test(t)) || "";
  const extra = tags.filter(
    (t) => t !== "One Pace" && !/^[\d-]+$/.test(t) && !/^\d{3,4}p$/i.test(t) && !/^[0-9A-F]{8}$/i.test(t)
  );
  // numero episodio = ultimo numero a 1-2 cifre prima dei tag finali (es. "... Romance Dawn 01 [1080p]")
  const stripped = name.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const m = stripped.match(/(?:^|\s)(\d{1,2})\s*$/);
  const episode = m ? parseInt(m[1], 10) : null;
  return { id: file.id, name: file.name, quality, extra, episode };
}

async function loadArc(arc, season) {
  let files;
  try {
    files = (await fetchList(arc.listId)).filter((f) => /\.(mkv|mp4|webm)$/i.test(f.name)).map(parseFile);
  } catch (e) {
    console.error(e.message);
    return { videos: [], byId: {} };
  }
  const groups = {};
  const unknown = files.filter((f) => f.episode == null).sort((a, b) => a.name.localeCompare(b.name));
  files.filter((f) => f.episode != null).forEach((f) => (groups[f.episode] ||= []).push(f));
  // senza numero riconoscibile: numera in ordine alfabetico dopo gli altri
  let next = Math.max(0, ...Object.keys(groups).map(Number)) + 1;
  unknown.forEach((f) => (groups[next++] = [f]));
  const videos = [];
  const byId = {};
  Object.keys(groups).map(Number).sort((a, b) => a - b).forEach((ep) => {
    const vid = `${SERIES_ID}:${season}:${ep}`;
    const custom = arc.titles && arc.titles[ep - 1]; // titolo facoltativo da arcs.json
    const num = String(ep).padStart(2, "0");
    // copertina: quella dell'arco se impostata, altrimenti un fotogramma del video da Pixeldrain
    const thumbnail = arc.thumbnail || `${PIXELDRAIN}/api/file/${groups[ep][0].id}/thumbnail`;
    videos.push({
      id: vid, season, episode: ep,
      title: custom ? `${num}. ${custom}` : `${arc.name} ${num}`,
      overview: arc.name,
      thumbnail,
      released: new Date(Date.UTC(2013, 0, 1, 0, 0, season * 60 + ep)).toISOString(),
    });
    byId[vid] = groups[ep];
  });
  return { videos, byId };
}

async function buildData() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending = (async () => {
    const results = await Promise.all(ARCS.map((arc, i) => loadArc(arc, i + 1)));
    const data = { videos: results.flatMap((r) => r.videos), byId: Object.assign({}, ...results.map((r) => r.byId)) };
    // non mettere in cache un risultato vuoto (es. Pixeldrain irraggiungibile)
    if (data.videos.length) { cache.data = data; cache.at = Date.now(); }
    return data;
  })().finally(() => (cache.pending = null));
  return cache.pending;
}

const metaBase = () => ({
  id: SERIES_ID,
  type: "series",
  name: "One Pace",
  poster: POSTER,
  background: BACKGROUND,
  logo: LOGO,
  description: "Il progetto fan One Pace: One Piece con il ritmo del manga.",
  genres: ["Anime", "Avventura"],
});

// Ritorna l'oggetto JSON per un path Stremio, oppure null se non esiste
async function handle(pathname) {
  const parts = decodeURIComponent(pathname).split("/").filter(Boolean);
  if (parts[0] === "manifest.json") return manifest;
  const [resource, , rest] = parts;
  const id = (rest || "").replace(/\.json$/, "");
  if (resource === "catalog") return { metas: [metaBase()] };
  if (resource === "meta" && id === SERIES_ID) {
    const { videos } = await buildData();
    return { meta: { ...metaBase(), videos } };
  }
  if (resource === "stream") {
    const { byId } = await buildData();
    return {
      streams: (byId[id] || []).map((f) => ({
        name: `One Pace\n${f.quality || "HD"}`,
        title: `${f.name}${f.extra.length ? "\n" + f.extra.join(" · ") : ""}`,
        url: `${PIXELDRAIN}/api/file/${f.id}`,
        behaviorHints: { notWebReady: false, bingeGroup: "onepace" },
      })),
    };
  }
  return null;
}

async function respond(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const pathname = new URL(req.url, "http://x").pathname;
  if (pathname === "/" || pathname === "/api" || pathname === "/api/index") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>One Pace (HTTP)</title>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 16px">
<h2>One Pace (HTTP)</h2><p>L'addon è attivo.</p>
<p>Incolla questo link in Nuvio (Impostazioni → Addon):</p>
<p><b>https://${host}/manifest.json</b></p></body>`);
  }
  res.setHeader("Content-Type", "application/json");
  try {
    const out = await handle(pathname);
    if (!out) { res.statusCode = 404; return res.end(JSON.stringify({ error: "not found" })); }
    res.end(JSON.stringify(out));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}

module.exports = respond;

if (require.main === module) {
  const PORT = process.env.PORT || 7000;
  require("http").createServer(respond).listen(PORT, "0.0.0.0", () =>
    console.log(`One Pace addon su http://localhost:${PORT}/manifest.json`));
}
