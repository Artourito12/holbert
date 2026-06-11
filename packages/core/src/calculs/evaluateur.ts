/**
 * Mini-évaluateur d'expressions arithmétiques SÛR (aucun eval) pour les
 * calculateurs dynamiques générés par l'IA (docs/09 §6).
 * Supporte : nombres, variables, + - * / %, parenthèses, comparaisons,
 * && || !, ternaire c ? a : b, fonctions min/max/abs/round/floor/ceil/pow.
 */

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const ops2 = ["<=", ">=", "==", "!=", "&&", "||"];
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new Error(`Nombre invalide : ${src.slice(i, j)}`);
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const deux = src.slice(i, i + 2);
    if (ops2.includes(deux)) {
      tokens.push({ t: "op", v: deux });
      i += 2;
      continue;
    }
    if ("+-*/%()<>?:,!".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Caractère interdit dans la formule : ${c}`);
  }
  return tokens;
}

const FONCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  pow: Math.pow,
};

export function evaluerFormule(formule: string, vars: Record<string, number>): number {
  const tokens = tokenize(formule);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (v?: string): Token => {
    const tok = tokens[pos];
    if (!tok) throw new Error("Formule incomplète");
    if (v !== undefined && !(tok.t === "op" && tok.v === v)) {
      throw new Error(`Attendu "${v}"`);
    }
    pos++;
    return tok;
  };

  // ternaire ← ou ← et ← comparaison ← addition ← multiplication ← unaire ← atome
  function ternaire(): number {
    const cond = ou();
    if (peek()?.t === "op" && peek().v === "?") {
      eat("?");
      const a = ternaire();
      eat(":");
      const b = ternaire();
      return cond !== 0 ? a : b;
    }
    return cond;
  }
  function ou(): number {
    let g = et();
    while (peek()?.t === "op" && peek().v === "||") {
      eat("||");
      const d = et();
      g = g !== 0 || d !== 0 ? 1 : 0;
    }
    return g;
  }
  function et(): number {
    let g = comparaison();
    while (peek()?.t === "op" && peek().v === "&&") {
      eat("&&");
      const d = comparaison();
      g = g !== 0 && d !== 0 ? 1 : 0;
    }
    return g;
  }
  function comparaison(): number {
    let g = addition();
    while (peek()?.t === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(peek().v as string)) {
      const op = eat().v as string;
      const d = addition();
      const r =
        op === "<" ? g < d : op === "<=" ? g <= d : op === ">" ? g > d
        : op === ">=" ? g >= d : op === "==" ? g === d : g !== d;
      g = r ? 1 : 0;
    }
    return g;
  }
  function addition(): number {
    let g = multiplication();
    while (peek()?.t === "op" && ["+", "-"].includes(peek().v as string)) {
      const op = eat().v;
      const d = multiplication();
      g = op === "+" ? g + d : g - d;
    }
    return g;
  }
  function multiplication(): number {
    let g = unaire();
    while (peek()?.t === "op" && ["*", "/", "%"].includes(peek().v as string)) {
      const op = eat().v;
      const d = unaire();
      g = op === "*" ? g * d : op === "/" ? g / d : g % d;
    }
    return g;
  }
  function unaire(): number {
    if (peek()?.t === "op" && peek().v === "-") {
      eat("-");
      return -unaire();
    }
    if (peek()?.t === "op" && peek().v === "!") {
      eat("!");
      return unaire() === 0 ? 1 : 0;
    }
    return atome();
  }
  function atome(): number {
    const tok = peek();
    if (!tok) throw new Error("Formule incomplète");
    if (tok.t === "num") {
      pos++;
      return tok.v;
    }
    if (tok.t === "op" && tok.v === "(") {
      eat("(");
      const v = ternaire();
      eat(")");
      return v;
    }
    if (tok.t === "id") {
      pos++;
      // Appel de fonction autorisée
      if (peek()?.t === "op" && peek().v === "(") {
        const fn = FONCTIONS[tok.v];
        if (!fn) throw new Error(`Fonction inconnue : ${tok.v}`);
        eat("(");
        const args: number[] = [ternaire()];
        while (peek()?.t === "op" && peek().v === ",") {
          eat(",");
          args.push(ternaire());
        }
        eat(")");
        return fn(...args);
      }
      // Variable
      if (!(tok.v in vars)) throw new Error(`Variable inconnue : ${tok.v}`);
      const v = vars[tok.v];
      if (typeof v !== "number" || Number.isNaN(v)) {
        throw new Error(`Valeur invalide pour ${tok.v}`);
      }
      return v;
    }
    throw new Error(`Élément inattendu : ${"v" in tok ? tok.v : "?"}`);
  }

  const resultat = ternaire();
  if (pos !== tokens.length) throw new Error("Formule mal formée");
  if (!Number.isFinite(resultat)) throw new Error("Résultat non fini");
  return resultat;
}
