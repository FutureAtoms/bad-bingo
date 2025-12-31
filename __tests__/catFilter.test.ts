/**
 * Cat Filter Service Tests
 * Tests for the cat filter functionality including face detection and filter application
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CAT_FILTERS,
  CatFilterType,
  getFilterConfig,
  applyCatFilter,
  detectFaceSimple,
  generateFilterPreviews,
} from '../services/catFilter';

describe('Cat Filter Service', () => {
  describe('CAT_FILTERS configuration', () => {
    it('should have all expected filter types', () => {
      const filterIds = CAT_FILTERS.map((f) => f.id);
      expect(filterIds).toContain('none');
      expect(filterIds).toContain('classic');
      expect(filterIds).toContain('anime');
      expect(filterIds).toContain('cyberpunk');
      expect(filterIds).toContain('whiskers');
    });

    it('should have 5 filter options', () => {
      expect(CAT_FILTERS).toHaveLength(5);
    });

    it('each filter should have required properties', () => {
      CAT_FILTERS.forEach((filter) => {
        expect(filter).toHaveProperty('id');
        expect(filter).toHaveProperty('name');
        expect(filter).toHaveProperty('description');
        expect(filter).toHaveProperty('icon');
        expect(filter).toHaveProperty('earsColor');
        expect(filter).toHaveProperty('noseColor');
        expect(filter).toHaveProperty('whiskersColor');
      });
    });

    it('none filter should have transparent colors', () => {
      const noneFilter = CAT_FILTERS.find((f) => f.id === 'none');
      expect(noneFilter?.earsColor).toBe('transparent');
      expect(noneFilter?.noseColor).toBe('transparent');
      expect(noneFilter?.whiskersColor).toBe('transparent');
    });

    it('cyberpunk and anime filters should have glow colors', () => {
      const cyberpunk = CAT_FILTERS.find((f) => f.id === 'cyberpunk');
      const anime = CAT_FILTERS.find((f) => f.id === 'anime');
      expect(cyberpunk?.glowColor).toBeDefined();
      expect(anime?.glowColor).toBeDefined();
    });

    it('classic filter should have orange tabby colors', () => {
      const classic = CAT_FILTERS.find((f) => f.id === 'classic');
      expect(classic?.earsColor).toBe('#FF9B50');
      expect(classic?.name).toBe('Classic Cat');
    });
  });

  describe('getFilterConfig', () => {
    it('should return correct config for valid filter type', () => {
      const config = getFilterConfig('classic');
      expect(config).toBeDefined();
      expect(config?.id).toBe('classic');
      expect(config?.name).toBe('Classic Cat');
    });

    it('should return undefined for invalid filter type', () => {
      const config = getFilterConfig('invalid' as CatFilterType);
      expect(config).toBeUndefined();
    });

    it('should return config for all valid filter types', () => {
      const validTypes: CatFilterType[] = ['none', 'classic', 'anime', 'cyberpunk', 'whiskers'];
      validTypes.forEach((type) => {
        const config = getFilterConfig(type);
        expect(config).toBeDefined();
        expect(config?.id).toBe(type);
      });
    });
  });

  describe('detectFaceSimple', () => {
    beforeEach(() => {
      // Mock Image constructor for testing
      global.Image = class MockImage {
        width = 400;
        height = 400;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          // Simulate async image load
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as unknown as typeof Image;
    });

    it('should detect face and return coordinates', async () => {
      const result = await detectFaceSimple('data:image/jpeg;base64,test');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });

    it('should return face landmarks', async () => {
      const result = await detectFaceSimple('data:image/jpeg;base64,test');
      expect(result).toHaveProperty('leftEye');
      expect(result).toHaveProperty('rightEye');
      expect(result).toHaveProperty('nose');
      expect(result).toHaveProperty('mouth');
    });

    it('should calculate face position relative to image size', async () => {
      const result = await detectFaceSimple('data:image/jpeg;base64,test');
      expect(result).not.toBeNull();
      if (result) {
        // Face should be roughly centered
        expect(result.x).toBeGreaterThan(0);
        expect(result.y).toBeGreaterThan(0);
        expect(result.width).toBeLessThan(400);
        expect(result.height).toBeLessThan(400);
      }
    });

    it('should return null for invalid image data', async () => {
      global.Image = class MockImage {
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as unknown as typeof Image;

      const result = await detectFaceSimple('invalid-data');
      expect(result).toBeNull();
    });
  });

  describe('applyCatFilter', () => {
    const mockDataUrl = 'data:image/jpeg;base64,/9j/4AAQtest';

    beforeEach(() => {
      // Mock Image and Canvas for testing
      const mockContext = {
        drawImage: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
        shadowColor: '',
        shadowBlur: 0,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
      };

      global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);
      global.HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,filtered');

      global.Image = class MockImage {
        width = 400;
        height = 400;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as unknown as typeof Image;
    });

    it('should return original image when filter is none', async () => {
      const result = await applyCatFilter(mockDataUrl, 'none');
      expect(result).toBe(mockDataUrl);
    });

    it('should apply classic filter and return modified data URL', async () => {
      const result = await applyCatFilter(mockDataUrl, 'classic');
      expect(result).toBe('data:image/jpeg;base64,filtered');
    });

    it('should apply anime filter', async () => {
      const result = await applyCatFilter(mockDataUrl, 'anime');
      expect(result).toBe('data:image/jpeg;base64,filtered');
    });

    it('should apply cyberpunk filter', async () => {
      const result = await applyCatFilter(mockDataUrl, 'cyberpunk');
      expect(result).toBe('data:image/jpeg;base64,filtered');
    });

    it('should apply whiskers-only filter', async () => {
      const result = await applyCatFilter(mockDataUrl, 'whiskers');
      expect(result).toBe('data:image/jpeg;base64,filtered');
    });

    it('should return original image for invalid filter type', async () => {
      const result = await applyCatFilter(mockDataUrl, 'invalid' as CatFilterType);
      expect(result).toBe(mockDataUrl);
    });
  });

  describe('generateFilterPreviews', () => {
    const mockDataUrl = 'data:image/jpeg;base64,test';

    beforeEach(() => {
      const mockContext = {
        drawImage: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
        shadowColor: '',
        shadowBlur: 0,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
      };

      global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);
      global.HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,preview');

      global.Image = class MockImage {
        width = 400;
        height = 400;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as unknown as typeof Image;
    });

    it('should generate previews for all filter types', async () => {
      const previews = await generateFilterPreviews(mockDataUrl);
      expect(previews).toBeInstanceOf(Map);
      expect(previews.size).toBe(CAT_FILTERS.length);
    });

    it('should have preview for each filter type', async () => {
      const previews = await generateFilterPreviews(mockDataUrl);
      CAT_FILTERS.forEach((filter) => {
        expect(previews.has(filter.id)).toBe(true);
      });
    });

    it('should return original for none filter', async () => {
      const previews = await generateFilterPreviews(mockDataUrl);
      expect(previews.get('none')).toBe(mockDataUrl);
    });
  });
});

describe('Cat Filter Type Definitions', () => {
  it('CatFilterType should include all valid types', () => {
    const validTypes: CatFilterType[] = ['none', 'classic', 'anime', 'cyberpunk', 'whiskers'];
    validTypes.forEach((type) => {
      const filter = CAT_FILTERS.find((f) => f.id === type);
      expect(filter).toBeDefined();
    });
  });
});
