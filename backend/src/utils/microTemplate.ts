/**
 * Micro-moteur de gabarit (sous-ensemble de Mustache) pour les modèles éditables
 * (bulletins). Volontairement minimal et sûr :
 *   {{var}}         → valeur échappée (HTML-safe)
 *   {{{var}}}       → valeur brute (fragments HTML calculés par le moteur)
 *   {{#section}}…{{/section}}
 *        - si la valeur est un tableau → répète le contenu pour chaque élément
 *        - si la valeur est « truthy » (non tableau) → rend le contenu une fois
 *        - sinon (falsy / tableau vide) → ignore
 *   {{^section}}…{{/section}} → rend le contenu si la valeur est falsy / vide
 *   {{! commentaire }} → ignoré
 *
 * La résolution des variables remonte la pile de contextes (élément de boucle
 * courant → parents → racine). Aucune évaluation de code, aucune I/O.
 */

type Ctx = Record<string, unknown>;

function escapeHtml(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

function lookup(stack: unknown[], key: string): unknown {
  if (key === '.') return stack[0];
  for (const ctx of stack) {
    if (ctx != null && typeof ctx === 'object' && key in (ctx as Ctx)) {
      return (ctx as Ctx)[key];
    }
  }
  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Trouve la balise fermante {{/name}} correspondant à une ouverture, en tenant
// compte des sections imbriquées de MÊME nom. `from` = index juste après l'ouverture.
function findClose(tpl: string, name: string, from: number): { start: number; end: number } {
  const re = new RegExp(`\\{\\{\\s*([#^/])\\s*${escapeRegExp(name)}\\s*\\}\\}`, 'g');
  re.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) return { start: m.index, end: re.lastIndex };
    } else {
      depth++;
    }
  }
  throw new Error(`Section {{#${name}}} non fermée`);
}

const TAG_SRC = /\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([#^/&!]?)\s*([\w.]+)?\s*\}\}/;

function renderNode(tpl: string, stack: unknown[]): string {
  let out = '';
  let cursor = 0;
  // Regex LOCALE (instance neuve) : `renderNode` est récursif et une regex globale
  // partagée verrait son `lastIndex` corrompu par les appels imbriqués → boucle.
  const tag = new RegExp(TAG_SRC.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = tag.exec(tpl)) !== null) {
    out += tpl.slice(cursor, m.index);
    cursor = tag.lastIndex;

    const tripleName = m[1];
    if (tripleName !== undefined) {
      const v = lookup(stack, tripleName);
      out += v == null ? '' : String(v);
      continue;
    }

    const sigil = m[2] ?? '';
    const name = m[3] ?? '';

    if (sigil === '!') continue; // commentaire

    if (sigil === '#' || sigil === '^') {
      const close = findClose(tpl, name, tag.lastIndex);
      const inner = tpl.slice(tag.lastIndex, close.start);
      cursor = close.end;
      tag.lastIndex = close.end;
      const v = lookup(stack, name);
      if (sigil === '#') {
        if (Array.isArray(v)) {
          for (const item of v) out += renderNode(inner, [item, ...stack]);
        } else if (v) {
          out += renderNode(inner, [typeof v === 'object' ? (v as Ctx) : {}, ...stack]);
        }
      } else {
        // ^ inversé : rendu si falsy ou tableau vide
        if (!v || (Array.isArray(v) && v.length === 0)) out += renderNode(inner, stack);
      }
      continue;
    }

    if (sigil === '&') {
      const v = lookup(stack, name);
      out += v == null ? '' : String(v);
      continue;
    }

    // {{name}} échappé
    out += escapeHtml(lookup(stack, name));
  }
  out += tpl.slice(cursor);
  return out;
}

export function renderMicroTemplate(tpl: string, data: Ctx): string {
  return renderNode(tpl, [data]);
}
