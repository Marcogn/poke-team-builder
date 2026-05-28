import { describe, it, expect } from 'vitest';
import { resolveSpriteUrl } from '../spriteUtils';

const HOME = 'https://example.com/home/1.png';
const ART = 'https://example.com/artwork/1.png';
const PIXEL = 'https://example.com/pixel/1.png';

describe('resolveSpriteUrl — card context', () => {
  it('returns HOME url when present', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: HOME, spriteArtwork: ART, spriteDefault: PIXEL },
        'card',
      ),
    ).toBe(HOME);
  });

  it('falls back to artwork when HOME is null', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: null, spriteArtwork: ART, spriteDefault: PIXEL },
        'card',
      ),
    ).toBe(ART);
  });

  it('falls back to pixel sprite when HOME and artwork are null', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: null, spriteArtwork: null, spriteDefault: PIXEL },
        'card',
      ),
    ).toBe(PIXEL);
  });

  it('returns null when every sprite field is null', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: null, spriteArtwork: null, spriteDefault: null },
        'card',
      ),
    ).toBeNull();
  });
});

describe('resolveSpriteUrl — dropdown context', () => {
  it('returns the pixel sprite regardless of HOME', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: HOME, spriteArtwork: ART, spriteDefault: PIXEL },
        'dropdown',
      ),
    ).toBe(PIXEL);
  });

  it('returns null when the pixel sprite is null', () => {
    expect(
      resolveSpriteUrl(
        { spriteHome: HOME, spriteArtwork: ART, spriteDefault: null },
        'dropdown',
      ),
    ).toBeNull();
  });
});

describe('resolveSpriteUrl — missing input', () => {
  it('returns null when pokemon is null in card context', () => {
    expect(resolveSpriteUrl(null, 'card')).toBeNull();
  });

  it('returns null when pokemon is null in dropdown context', () => {
    expect(resolveSpriteUrl(null, 'dropdown')).toBeNull();
  });

  it('returns null when pokemon is undefined', () => {
    expect(resolveSpriteUrl(undefined, 'card')).toBeNull();
    expect(resolveSpriteUrl(undefined, 'dropdown')).toBeNull();
  });

  it('returns null for a custom Pokémon with no sprite fields (both contexts)', () => {
    const custom = {} as { spriteHome?: null; spriteArtwork?: null; spriteDefault?: null };
    expect(resolveSpriteUrl(custom, 'card')).toBeNull();
    expect(resolveSpriteUrl(custom, 'dropdown')).toBeNull();
  });
});
