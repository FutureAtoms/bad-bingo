import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockReturnThis(),
  })),
  auth: {
    signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
};

vi.mock('../services/supabase', () => ({
  supabase: mockSupabaseClient,
  db: mockSupabaseClient, // db is the same as supabase, just untyped
  isSupabaseConfigured: true, // Always true in tests (mocked env)
  getCurrentUserId: vi.fn().mockResolvedValue(null),
  isAuthenticated: vi.fn().mockResolvedValue(false),
}));

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
