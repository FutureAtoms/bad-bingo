import { vi } from 'vitest';

export type SupabaseResult<T> = {
  data?: T;
  error?: { message?: string } | null;
  count?: number | null;
};

export const createSupabaseQuery = <T>(result: SupabaseResult<T>) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: SupabaseResult<T>) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return chain;
};
