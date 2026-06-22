#!/usr/bin/env node
/**
 * WhichOTT — TMDB India data sanity check (standalone, NOT the app).
 *
 * Purpose: see whether TMDB knows which OTT platforms stream a given film
 * in India (watch_region=IN). If this data is accurate enough, the product
 * is viable. If it's wrong/stale, we rethink the data source first.
 *
 * ── How to run ──────────────────────────────────────────────────────────
 * 1. Get a free TMDB key: https://www.themoviedb.org/settings/api
 *    (Either the v3 "API Key" OR the v4 "API Read Access Token" works.)
 * 2. In Terminal, from this folder:
 *
 *       export TMDB_API_KEY="paste-your-key-here"
 *       node tmdb-check.mjs
 *
 * 3. Edit the FILMS list below to titles YOU know the real answer for,
 *    then eyeball whether the printed platforms match reality.
 *
 * Needs Node 18+ (uses built-in fetch). Zero dependencies.
 */

// ── Edit this list: titles you personally know where they stream in India ──
const FILMS = [
  "Jawan",                 // recent Hindi
  "Animal",                // recent Hindi
  "Manjummel Boys",        // Malayalam (regional accuracy test)
  "Premalu",               // Malayalam
  "Leo",                   // Tamil
  "Jailer",                // Tamil
  "Kantara",               // Kannada
  "RRR",                   // Telugu/Hindi
  "3 Idiots",              // old Hindi classic
  "Drishyam",              // older Malayalam/Hindi
  "Oppenheimer",           // Hollywood in India
  "The Dark Knight",       // old Hollywood
];

const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error("\n❌ No TMDB key found. Run:\n   export TMDB_API_KEY=\"your-key\"\n   node tmdb-check.mjs\n");
  process.exit(1);
}

// v4 tokens are JWTs (start with 'eyJ') → use Bearer header.
// v3 keys → passed as ?api_key=... query param.
const isV4 = KEY.startsWith("eyJ");
const BASE = "https://api.themoviedb.org/3";

async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!isV4) url.searchParams.set("api_key", KEY);
  const res = await fetch(url, isV4 ? { headers: { Authorization: `Bearer ${KEY}` } } : {});
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

function names(arr) {
  return arr && arr.length ? arr.map((p) => p.provider_name).join(", ") : "—";
}

async function checkFilm(title) {
  const search = await tmdb("/search/movie", { query: title, region: "IN", language: "en-US" });
  const movie = search.results?.[0];
  if (!movie) {
    console.log(`\n🎬 ${title}\n   ⚠️  No match found on TMDB.`);
    return;
  }
  const year = (movie.release_date || "????").slice(0, 4);
  const prov = await tmdb(`/movie/${movie.id}/watch/providers`);
  const IN = prov.results?.IN;

  console.log(`\n🎬 ${title}  →  matched: "${movie.title}" (${year})  [id ${movie.id}]`);
  if (!IN) {
    console.log(`   ❌ No India (IN) streaming data at all.`);
    return;
  }
  console.log(`   📺 Stream (subscription): ${names(IN.flatrate)}`);
  console.log(`   📺 Free / with ads:       ${names(IN.ads)}`);
  console.log(`   💸 Rent:                  ${names(IN.rent)}`);
  console.log(`   💰 Buy:                   ${names(IN.buy)}`);
}

console.log("── WhichOTT · TMDB India watch-provider check ──");
console.log(`Auth mode: ${isV4 ? "v4 Bearer token" : "v3 api_key"}`);

for (const film of FILMS) {
  try {
    await checkFilm(film);
  } catch (e) {
    console.log(`\n🎬 ${film}\n   💥 Error: ${e.message}`);
  }
}

console.log("\n── Done. Now judge: do these match what you KNOW is true in India? ──\n");
