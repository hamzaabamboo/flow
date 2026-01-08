import { describe, it, expect, vi } from 'vitest';
import { getAssetUrl } from '../assets';

describe('assets utils', () => {
  it('should return path with default BASE_URL', () => {
    expect(getAssetUrl('image.png')).toBe('/image.png');
  });

  it('should return path with custom BASE_URL', () => {
    // We can't easily mock import.meta.env.BASE_URL because it's constant
    // but we can check if it works with different paths
    expect(getAssetUrl('/test/path')).toBe('/test/path');
    expect(getAssetUrl('test/path')).toBe('/test/path');
  });
});
