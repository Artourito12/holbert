import { lierCitations } from "../lib/legifrance";

/** Rendu markdown minimal (titres, gras, italique, listes, lignes)
 *  + liens Légifrance automatiques sur les citations d'articles. */
export default function RenduTexte({ texte }: { texte: string }) {
  const html = lierCitations(
    texte
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3 class='mt-4 mb-1 text-sm font-semibold'>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class='mt-5 mb-1.5 text-base font-semibold'>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1 class='mt-5 mb-2 text-lg font-semibold'>$1</h1>")
      .replace(/^- (.+)$/gm, "<li class='ml-5 list-disc'>$1</li>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/^---$/gm, "<hr class='my-3 border-gray-200 dark:border-gray-700'/>")
      // Liens markdown [label](url) — traités AVANT les URLs brutes
      .replace(
        /\[([^\]]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]+)\)/g,
        "<a href='$2' class='font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700'>$1</a>"
      )
      // URLs brutes → liens cliquables (préfixe requis pour ne pas toucher les href déjà posés)
      .replace(
        /(^|[\s(>])(https?:\/\/[^\s<)'"]+)/g,
        "$1<a href='$2' target='_blank' rel='noopener noreferrer' class='break-all text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700'>$2</a>"
      )
      .replace(/\n/g, "<br/>")
      .replace(/<\/h(\d)><br\/>/g, "</h$1>")
      .replace(/<\/li><br\/>/g, "</li>")
  );
  return (
    <div
      className="text-sm leading-relaxed text-gray-800 dark:text-gray-100"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
