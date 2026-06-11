import { readFileSync } from "node:fs";
for (const l of readFileSync("C:/Users/aarra/Desktop/holbert/.env.local", "utf8").replace(/^﻿/, "").split("\n")) {
  const m = l.trim().match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const PROJECT = "prj_yMy5bRiwE7CdwZX9mcC57hBcYJHf";
const TEAM = "team_pazXlOSVCINnOzMinLOjvQ3c";
const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.log("VERCEL_TOKEN absent de .env.local");
  process.exit(1);
}

// 1. Statut du domaine chez Resend (pour EMAIL_FROM)
let resendOk = false;
if (process.env.RESEND_API_KEY) {
  const r = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  const j = await r.json();
  const dom = (j.data ?? []).find((d) => d.name === "hofraad.com");
  console.log(`Resend hofraad.com : ${dom ? dom.status : "non ajouté"}`);
  resendOk = dom?.status === "verified";
}

// 2. Mise à jour des variables Vercel (production)
const vars = [{ key: "APP_URL", value: "https://hofraad.com", type: "encrypted", target: ["production"] }];
if (resendOk) {
  vars.push({
    key: "EMAIL_FROM",
    value: "Hofraad <notifications@hofraad.com>",
    type: "encrypted",
    target: ["production"],
  });
}
const res = await fetch(
  `https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(vars),
  }
);
console.log(`Vercel env (${vars.map((v) => v.key).join(", ")}) : HTTP ${res.status}`);
if (!res.ok) console.log(JSON.stringify(await res.json()).slice(0, 400));

// 3. Vérification que hofraad.com répond
try {
  const ping = await fetch("https://hofraad.com/accueil", { redirect: "follow" });
  console.log(`https://hofraad.com/accueil : HTTP ${ping.status}`);
} catch (e) {
  console.log(`hofraad.com injoignable pour l'instant : ${e.message}`);
}
