import referentiels from "./referentiels.generated.json" with { type: "json" };

/** Tous les référentiels, indexés par id. */
export const REFERENTIELS = referentiels;

/** Référentiel d'un type confirmé, avec repli sur le générique. */
export function getReferentiel(typeId) {
  return REFERENTIELS[typeId] ?? REFERENTIELS.generique;
}

/** Liste compacte des types pour le prompt de classification (étage 1). */
export function typesPourClassification() {
  return Object.values(REFERENTIELS)
    .filter((r) => r.meta.id !== "generique")
    .map((r) => ({
      id: r.meta.id,
      nom: r.meta.nom,
      indices: r.identification.indices,
      pieges_confusion: r.identification.pieges_confusion,
    }));
}
