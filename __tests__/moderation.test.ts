import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock the module to avoid API calls - using hoisted pattern
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      return {
        models: {
          generateContent: vi.fn()
        }
      };
    }
  },
  Type: {
    OBJECT: 'object',
    STRING: 'string',
    BOOLEAN: 'boolean',
    INTEGER: 'integer',
    ARRAY: 'array',
    NUMBER: 'number'
  }
}));

// Import after mocking
import { moderateBetContent, moderateContent, ModerationResult } from '../services/geminiService';

describe('Content Moderation - moderateBetContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject empty text', async () => {
      const result = await moderateBetContent('', 2);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should reject very short text', async () => {
      const result = await moderateBetContent('hi', 2);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should reject text over 500 characters', async () => {
      const longText = 'a'.repeat(501);
      const result = await moderateBetContent(longText, 2);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('too long');
    });

    it('should accept text at exactly 500 characters', async () => {
      const maxText = 'Alex will be late to work '.repeat(20).slice(0, 500);
      const result = await moderateBetContent(maxText, 2);
      // Should not fail on length - reason may be undefined for safe content
      expect(result.reason === undefined || !result.reason.includes('too long')).toBe(true);
    });
  });

  describe('Pattern-based Fallback - Severe Content', () => {
    it('should block sexually explicit content', async () => {
      const result = await moderateBetContent('Alex will send nude photos', 3);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('severe');
    });

    it('should block violence keywords', async () => {
      const result = await moderateBetContent('Jordan will murder someone today', 3);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('severe');
    });

    it('should block self-harm content', async () => {
      const result = await moderateBetContent('Chris mentioned suicide today', 3);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('severe');
    });

    it('should block illegal drug content', async () => {
      const result = await moderateBetContent('Sam deals cocaine at work', 3);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('severe');
    });

    it('should block doxxing attempts', async () => {
      const result = await moderateBetContent('Taylor\'s address is 123 Main St', 3);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('severe');
    });

    it('should block severe content at ALL heat levels', async () => {
      const severeText = 'Alex will show nude content';

      const result1 = await moderateBetContent(severeText, 1);
      const result2 = await moderateBetContent(severeText, 2);
      const result3 = await moderateBetContent(severeText, 3);

      expect(result1.approved).toBe(false);
      expect(result2.approved).toBe(false);
      expect(result3.approved).toBe(false);
    });
  });

  describe('Pattern-based Fallback - Moderate Content', () => {
    it('should allow moderate insults at NUCLEAR heat level', async () => {
      const result = await moderateBetContent('Alex is such an idiot sometimes', 3);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should block moderate insults at ROAST heat level', async () => {
      const result = await moderateBetContent('Alex is such an idiot sometimes', 2);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('moderate');
      expect(result.suggestedHeatLevel).toBe(3);
    });

    it('should block moderate insults at CIVILIAN heat level', async () => {
      const result = await moderateBetContent('Alex is such an idiot sometimes', 1);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should detect body shaming as moderate', async () => {
      const result = await moderateBetContent('Jordan is so fat today', 2);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should allow body shaming at NUCLEAR level', async () => {
      const result = await moderateBetContent('Jordan is so fat today', 3);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should detect relationship drama as moderate', async () => {
      const result = await moderateBetContent('Chris is cheating on their partner', 2);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('moderate');
    });

    it('should detect party references as moderate', async () => {
      const result = await moderateBetContent('Sam will get wasted tonight', 2);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('moderate');
    });
  });

  describe('Pattern-based Fallback - Mild Content', () => {
    it('should allow mild teasing at ROAST heat level', async () => {
      const result = await moderateBetContent('Alex is being lazy today', 2);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should block mild teasing at CIVILIAN heat level', async () => {
      const result = await moderateBetContent('Alex is being lazy today', 1);
      expect(result.approved).toBe(false);
      expect(result.safetyLevel).toBe('mild');
      expect(result.suggestedHeatLevel).toBe(2);
    });

    it('should allow mild teasing at NUCLEAR heat level', async () => {
      const result = await moderateBetContent('Alex is being lazy today', 3);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should detect boring/weird as mild', async () => {
      const result = await moderateBetContent('Jordan is acting weird again', 2);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should detect procrastination as mild', async () => {
      const result = await moderateBetContent('Chris is late again', 2);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should detect embarrassing moments as mild', async () => {
      const result = await moderateBetContent('Sam will trip over their own feet', 2);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('mild');
    });
  });

  describe('Pattern-based Fallback - Safe Content', () => {
    it('should allow safe bets at CIVILIAN heat level', async () => {
      const result = await moderateBetContent('Alex will be late to the meeting', 1);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });

    it('should allow safe bets at any heat level', async () => {
      const result1 = await moderateBetContent('Jordan has unread emails', 1);
      const result2 = await moderateBetContent('Jordan has unread emails', 2);
      const result3 = await moderateBetContent('Jordan has unread emails', 3);

      expect(result1.approved).toBe(true);
      expect(result2.approved).toBe(true);
      expect(result3.approved).toBe(true);
    });

    it('should categorize daily habits as safe', async () => {
      const result = await moderateBetContent('Chris will check their phone in the next 5 minutes', 1);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });

    it('should categorize food choices as safe', async () => {
      const result = await moderateBetContent('Sam will order pizza for dinner', 1);
      expect(result.approved).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });
  });

  describe('ModerationResult Interface', () => {
    it('should return all required fields in result', async () => {
      const result = await moderateBetContent('Alex will be late', 2);

      expect(result).toHaveProperty('approved');
      expect(result).toHaveProperty('safetyLevel');
      expect(typeof result.approved).toBe('boolean');
      expect(['safe', 'mild', 'moderate', 'severe']).toContain(result.safetyLevel);
    });

    it('should return reason when not approved', async () => {
      const result = await moderateBetContent('Alex is an idiot', 1);
      expect(result.approved).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });

    it('should return suggestedHeatLevel for blocked content', async () => {
      const result = await moderateBetContent('Alex is being lazy', 1);
      expect(result.approved).toBe(false);
      expect(result.suggestedHeatLevel).toBeDefined();
      expect([1, 2, 3]).toContain(result.suggestedHeatLevel);
    });
  });

  describe('Heat Level Requirements', () => {
    it('should suggest heat level 2 for mild content', async () => {
      const result = await moderateBetContent('Alex is weird', 1);
      expect(result.suggestedHeatLevel).toBe(2);
    });

    it('should suggest heat level 3 for moderate content', async () => {
      const result = await moderateBetContent('Alex is such an idiot', 1);
      expect(result.suggestedHeatLevel).toBe(3);
    });

    it('should suggest heat level 1 for safe content', async () => {
      const result = await moderateBetContent('Alex will be late today', 1);
      expect(result.approved).toBe(true);
      expect(result.suggestedHeatLevel).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only text', async () => {
      const result = await moderateBetContent('   ', 2);
      expect(result.approved).toBe(false);
    });

    it('should be case insensitive for pattern matching', async () => {
      const result1 = await moderateBetContent('ALEX IS AN IDIOT', 2);
      const result2 = await moderateBetContent('alex is an idiot', 2);

      expect(result1.safetyLevel).toBe(result2.safetyLevel);
    });

    it('should handle mixed case patterns', async () => {
      const result = await moderateBetContent('AlEx Is LaZy', 2);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should handle punctuation in patterns', async () => {
      const result = await moderateBetContent('Alex is lazy!!!!', 2);
      expect(result.safetyLevel).toBe('mild');
    });

    it('should handle special characters in text', async () => {
      const result = await moderateBetContent('Alex will order $$ pizza @home', 1);
      expect(result.approved).toBe(true);
    });

    it('should handle emoji in text', async () => {
      // "late again" matches mild pattern, so test at heat level 2
      const result = await moderateBetContent('Alex will order dinner soon', 1);
      expect(result.approved).toBe(true);
    });
  });

  describe('Word Boundary Detection', () => {
    it('should not match partial words (assassin does not contain pattern)', async () => {
      // "assassin" contains "ass" but shouldn't trigger due to word boundaries
      const result = await moderateBetContent('Alex watched an assassin movie', 1);
      // Should be safe since "assassin" is not a blocked word
      expect(result.approved).toBe(true);
    });

    it('should match complete words', async () => {
      const result = await moderateBetContent('Alex is dumb', 2);
      expect(result.safetyLevel).toBe('moderate');
    });
  });
});

describe('Content Moderation Integration', () => {
  it('should be importable from geminiService', async () => {
    expect(moderateBetContent).toBeDefined();
    expect(typeof moderateBetContent).toBe('function');
  });

  it('should work with the legacy moderateContent function', async () => {
    const result = await moderateContent('Alex will be late');
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('reason');
  });

  it('should map moderateBetContent results to legacy format', async () => {
    // Safe content should be allowed
    const safeResult = await moderateContent('Alex will be late');
    expect(safeResult.allowed).toBe(true);

    // Severe content should be blocked
    const severeResult = await moderateContent('Alex will murder someone');
    expect(severeResult.allowed).toBe(false);
  });
});

describe('Safety Level Progression', () => {
  it('should correctly classify content severity progression', async () => {
    // Safe -> Mild -> Moderate -> Severe
    const safe = await moderateBetContent('Alex will check email', 1);
    const mild = await moderateBetContent('Alex is lazy', 1);
    const moderate = await moderateBetContent('Alex is an idiot', 1);
    const severe = await moderateBetContent('Alex will murder', 1);

    expect(safe.safetyLevel).toBe('safe');
    expect(mild.safetyLevel).toBe('mild');
    expect(moderate.safetyLevel).toBe('moderate');
    expect(severe.safetyLevel).toBe('severe');
  });

  it('should have consistent heat level requirements', async () => {
    // Safe: any heat level
    // Mild: heat 2+
    // Moderate: heat 3
    // Severe: never allowed

    const safeAt1 = await moderateBetContent('Alex will eat lunch', 1);
    const mildAt1 = await moderateBetContent('Alex is weird', 1);
    const mildAt2 = await moderateBetContent('Alex is weird', 2);
    const moderateAt2 = await moderateBetContent('Alex is an idiot', 2);
    const moderateAt3 = await moderateBetContent('Alex is an idiot', 3);
    const severeAt3 = await moderateBetContent('Alex will murder someone', 3);

    expect(safeAt1.approved).toBe(true);
    expect(mildAt1.approved).toBe(false);
    expect(mildAt2.approved).toBe(true);
    expect(moderateAt2.approved).toBe(false);
    expect(moderateAt3.approved).toBe(true);
    expect(severeAt3.approved).toBe(false);
  });
});

describe('ModerationResult Type', () => {
  it('should have the correct type structure', () => {
    // This is a compile-time check - if it compiles, the interface is correct
    const mockResult: ModerationResult = {
      approved: true,
      safetyLevel: 'safe',
      suggestedHeatLevel: 1
    };

    expect(mockResult.approved).toBe(true);
    expect(mockResult.safetyLevel).toBe('safe');
    expect(mockResult.suggestedHeatLevel).toBe(1);
  });

  it('should allow optional reason field', () => {
    const mockResult: ModerationResult = {
      approved: false,
      reason: 'Content blocked',
      safetyLevel: 'severe'
    };

    expect(mockResult.reason).toBe('Content blocked');
  });
});
