import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/** Convertit une ligne markdown simple (gras **x**) en runs docx. */
function runs(texte: string): TextRun[] {
  return texte.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith("**") && part.endsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true })
      : new TextRun({ text: part })
  );
}

/** Génère un .docx depuis le markdown simple produit par la plateforme. */
export async function telechargerDocx(titre: string, markdown: string) {
  const paragraphs: Paragraph[] = [];
  for (const ligne of markdown.split("\n")) {
    const l = ligne.trimEnd();
    if (!l.trim()) {
      paragraphs.push(new Paragraph({ text: "" }));
    } else if (l.startsWith("### ")) {
      paragraphs.push(new Paragraph({ text: l.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (l.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: l.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (l.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: l.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (l.startsWith("- ")) {
      paragraphs.push(new Paragraph({ children: runs(l.slice(2)), bullet: { level: 0 } }));
    } else {
      paragraphs.push(new Paragraph({ children: runs(l) }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "IBM Plex Sans", size: 22 } }, // 11pt
      },
    },
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titre.replace(/[^a-zA-Z0-9À-ÿ ._-]/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
