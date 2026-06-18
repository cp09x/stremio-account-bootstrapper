import { describe, expect, it } from 'vitest';
import { applyCatalogRatingPreferences } from './aiometadata';

describe('applyCatalogRatingPreferences', () => {
  it('keeps trending as trending and makes streaming provider rows rating-first', () => {
    const catalogs = applyCatalogRatingPreferences([
      {
        id: 'tmdb.trending',
        source: 'tmdb',
        type: 'movie',
        name: 'Trending Movies'
      },
      {
        id: 'streaming.nfx',
        source: 'streaming',
        type: 'movie',
        name: 'Netflix Movies',
        sort: 'release_date',
        sortDirection: 'desc'
      }
    ]);

    expect(catalogs[0]).toEqual({
      id: 'tmdb.trending',
      source: 'tmdb',
      type: 'movie',
      name: 'Trending Movies'
    });
    expect(catalogs[1]).toMatchObject({
      id: 'streaming.nfx',
      sort: 'vote_average',
      sortDirection: 'desc'
    });
  });

  it('enables top rated rows without randomizing rating order', () => {
    const catalogs = applyCatalogRatingPreferences([
      {
        id: 'tmdb.discover.movie.top_rated.mlz4ps5f',
        source: 'tmdb',
        type: 'movie',
        name: 'Top Rated Movies',
        enabled: false,
        showInHome: true,
        randomizePerPage: true
      }
    ]);

    expect(catalogs[0]).toMatchObject({
      enabled: true,
      showInHome: true,
      randomizePerPage: false
    });
  });
});
