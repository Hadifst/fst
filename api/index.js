//Dont-Visit-Tis-is-section//
export const config = { runtime: "edge" };

const BASE = (process.env.TARGET_DOMAIN || "").replace(/\/+$/, "");

// هدرهایی که طبق استاندارد نباید forward بشن
const HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const isBodyAllowed = (method) =>
  method !== "GET" && method !== "HEAD";

function resolveTarget(reqUrl) {
  const { pathname, search } = new URL(reqUrl);
  return BASE + pathname + search;
}

function sanitizeHeaders(incoming) {
  const result = new Headers();

  for (const [key, value] of incoming.entries()) {
    const k = key.toLowerCase();

    if (k === "host") continue;
    if (k.startsWith("x-vercel-")) continue;
    if (HOP_HEADERS.includes(k)) continue;

    result.set(key, value);
  }

  return result;
}

async function forward(req, url) {
  return fetch(url, {
    method: req.method,
    headers: sanitizeHeaders(req.headers),
    body: isBodyAllowed(req.method) ? req.body : undefined,
    redirect: "manual",
  });
}

function buildResponse(res) {
  const headers = new Headers(res.headers);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default async function handler(req) {
  if (!BASE) {
    return new Response("TARGET_DOMAIN not configured", { status: 500 });
  }

  let target;

  try {
    target = resolveTarget(req.url);
  } catch {
    return new Response("Invalid request URL", { status: 400 });
  }

  try {
    const upstream = await forward(req, target);
    return buildResponse(upstream);
  } catch (e) {
    console.error("proxy failure:", e);
    return new Response("Upstream error", { status: 502 });
  }
}
