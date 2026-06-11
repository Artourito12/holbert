/**
 * Liens Légifrance déterministes (sans clé API) : toute citation d'article
 * détectée dans un texte devient un lien de recherche legifrance.gouv.fr.
 * La vérification authentique (API PISTE) s'y substituera quand les clés
 * seront configurées (cf. api/_lib/legifrance.js).
 */

// "art. L. 145-4 c. com.", "article 2224 du code civil", "art. R. 212-1 c. consom."…
const CITATION =
  /\b(art(?:icle)?s?\.?\s+(?:[LRD]\.?\s*)?\d+(?:-\d+)*(?:\s+et\s+suivants)?\s+(?:du\s+|de\s+la\s+)?(?:c(?:ode)?\.?\s*[a-zéèêàçù.]{2,12}\.?(?:\s?[a-zéèêàçù]{2,12}\.?)?|loi\s+du\s+\d+\s+\w+\s+\d{4}|CPC|CPCE|CPI|CGI))/gi;

export function lienLegifrance(citation: string): string {
  return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&query=${encodeURIComponent(citation)}`;
}

/** Enrichit un HTML déjà échappé : citations → liens Légifrance. */
export function lierCitations(html: string): string {
  return html.replace(CITATION, (match) => {
    return `<a href="${lienLegifrance(match)}" target="_blank" rel="noopener noreferrer" class="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700">${match}</a>`;
  });
}
