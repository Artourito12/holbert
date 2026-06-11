import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

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

  // Images : OCR non couvert à ce jalon
  return { texte: "", pages: null };
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
