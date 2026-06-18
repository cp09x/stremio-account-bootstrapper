import { describe, expect, it } from 'vitest';
import { diffAddonCollections } from './addonDiff';

const addon = (id: string, name: string, transportUrl?: string) => ({
  transportUrl: transportUrl ?? `https://example.com/${id}/manifest.json`,
  manifest: { id, name }
});

describe('diffAddonCollections', () => {
  it('reports an addon that was added', () => {
    const current = [addon('a', 'Alpha')];
    const next = [addon('a', 'Alpha'), addon('b', 'Beta')];

    const result = diffAddonCollections(current, next);

    expect(result.added).toEqual(['Beta']);
    expect(result.removed).toEqual([]);
    expect(result.kept).toEqual(['Alpha']);
    expect(result.reordered).toBe(false);
  });

  it('reports an addon that was removed', () => {
    const current = [addon('a', 'Alpha'), addon('b', 'Beta')];
    const next = [addon('a', 'Alpha')];

    const result = diffAddonCollections(current, next);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(['Beta']);
    expect(result.kept).toEqual(['Alpha']);
    expect(result.reordered).toBe(false);
  });

  it('reports addons that were kept with no changes', () => {
    const current = [addon('a', 'Alpha'), addon('b', 'Beta')];
    const next = [addon('a', 'Alpha'), addon('b', 'Beta')];

    const result = diffAddonCollections(current, next);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.kept).toEqual(['Alpha', 'Beta']);
    expect(result.reordered).toBe(false);
  });

  it('detects a reorder-only change', () => {
    const current = [addon('a', 'Alpha'), addon('b', 'Beta')];
    const next = [addon('b', 'Beta'), addon('a', 'Alpha')];

    const result = diffAddonCollections(current, next);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.kept.sort()).toEqual(['Alpha', 'Beta']);
    expect(result.reordered).toBe(true);
  });

  it('matches by transportUrl when manifest.id is missing', () => {
    const current = [
      { transportUrl: 'https://x/manifest.json', manifest: { name: 'X' } }
    ];
    const next = [
      { transportUrl: 'https://x/manifest.json', manifest: { name: 'X' } }
    ];

    const result = diffAddonCollections(current, next);

    expect(result.kept).toEqual(['X']);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('is robust to missing/empty inputs', () => {
    expect(diffAddonCollections(null, undefined)).toEqual({
      added: [],
      removed: [],
      kept: [],
      reordered: false
    });

    const result = diffAddonCollections([], [addon('a', 'Alpha')]);
    expect(result.added).toEqual(['Alpha']);
  });
});
