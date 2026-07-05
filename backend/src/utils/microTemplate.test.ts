import { describe, it, expect } from 'vitest';
import { renderMicroTemplate as r } from './microTemplate';

describe('microTemplate', () => {
  it('échappe les variables simples', () => {
    expect(r('Bonjour {{nom}}', { nom: '<b>&A' })).toBe('Bonjour &lt;b&gt;&amp;A');
  });

  it('rend le HTML brut avec triple accolade', () => {
    expect(r('{{{h}}}', { h: '<i>x</i>' })).toBe('<i>x</i>');
  });

  it('répète une section tableau', () => {
    expect(r('{{#items}}[{{v}}]{{/items}}', { items: [{ v: 1 }, { v: 2 }, { v: 3 }] })).toBe('[1][2][3]');
  });

  it('ignore une section sur tableau vide', () => {
    expect(r('a{{#items}}X{{/items}}b', { items: [] })).toBe('ab');
  });

  it('rend une section booléenne selon la valeur', () => {
    expect(r('{{#ok}}OUI{{/ok}}', { ok: true })).toBe('OUI');
    expect(r('{{#ok}}OUI{{/ok}}', { ok: false })).toBe('');
  });

  it('gère la section inversée', () => {
    expect(r('{{^items}}aucun{{/items}}', { items: [] })).toBe('aucun');
    expect(r('{{^items}}aucun{{/items}}', { items: [1] })).toBe('');
  });

  it('remonte au contexte parent depuis une boucle', () => {
    expect(r('{{#l}}{{v}}/{{base}} {{/l}}', { base: 20, l: [{ v: 15 }, { v: 8 }] })).toBe('15/20 8/20 ');
  });

  it('gère l’imbrication section + condition', () => {
    const tpl = '{{#t}}[{{titre}}{{#bil}}-AR{{/bil}}]{{/t}}';
    expect(r(tpl, { t: [{ titre: 'FR', bil: false }, { titre: 'AR', bil: true }] })).toBe('[FR][AR-AR]');
  });

  it('gère des sections imbriquées de même nom', () => {
    expect(r('{{#a}}<{{#a}}.{{/a}}>{{/a}}', { a: [{ a: [1, 2] }, { a: [3] }] })).toBe('<..><.>');
  });

  it('remplace un placeholder inconnu par du vide', () => {
    expect(r('x{{nope}}y', {})).toBe('xy');
  });
});
