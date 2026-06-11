import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { anthropic, MODEL_FAST } from "./claude.js";

/**
 * Extrait le texte brut d'un document selon son type MIME.
 * Retourne { texte, pages } — texte vide si le format n'est pas lisible
 * (scan image sans OCR : prévu à un jalon ultérieur).
 */
export async function extraireTexte(buffer, mime) {
  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { texte: (text ?? "").trim(), pages: totalPages ?? null };
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return { texte: (value ?? "").trim(), pages: null };
  }

  if (mime === "text/plain" || mime === "message/rfc822") {
    return { texte: Buffer.from(buffer).toString("utf8").trim(), pages: null };
  }

  return { texte: "", pages: null };
}

const OCR_MAX_OCTETS = 20 * 1024 * 1024;
const OCR_MIMES = ["application/pdf", "image/png", "image/jpeg"];

/**
 * Extraction avec OCR de secours : si le texte natif est vide (scan, photo),
 * le document passe par la vision Claude pour transcription (docs/09 §7).
 */
export async function extraireTexteAvecOcr(buffer, mime) {
  const base = await extraireTexte(buffer, mime);
  if (base.texte && base.texte.length >= 40) return { ...base, ocr: false };
  if (!OCR_MIMES.includes(mime) || buffer.byteLength > OCR_MAX_OCTETS) {
    return { ...base, ocr: false };
  }

  const data = Buffer.from(buffer).toString("base64");
  const bloc =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime, data } };

  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          bloc,
          {
            type: "text",
            text:
              "Transcrivez intégralement et fidèlement le texte de ce document, sans commentaire ni " +
              "résumé. Conservez la structure (titres, paragraphes, listes). Marquez [illisible] " +
              "pour les passages indéchiffrables.",
          },
        ],
      },
    ],
  });
  const texte = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { texte, pages: base.pages, ocr: texte.length >= 40 };
}

/**
 * Découpe un texte en chunks d'environ 3000 caractères (~800 tokens),
 * avec chevauchement de 15 %, en respectant les fins de paragraphes.
 */
export function chunker(texte, taille = 3000, chevauchement = 450) {
  const chunks = [];
  let debut = 0;
  while (debut < texte.length) {
    let fin = Math.min(debut + taille, texte.length);
    if (fin < texte.length) {
      const coupure = texte.lastIndexOf("\n", fin);
      if (coupure > debut + taille / 2) fin = coupure;
    }
    const contenu = texte.slice(debut, fin).trim();
    if (contenu) chunks.push(contenu);
    if (fin >= texte.length) break;
    debut = fin - chevauchement;
  }
  return chunks;
}
