import { z } from 'zod';

export const RecommendRequestSchema = z.object({
  merchant_id: z.string().min(1, 'merchant_id is required'),
});

export const MerchantSearchQuerySchema = z.object({
  q: z.string().min(1, 'q parameter is required'),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export const CategoryEnum = z.enum([
  'GROCERY',
  'DINING',
  'TRAVEL_GENERAL',
  'TRAVEL_HOTELS',
  'TRAVEL_AIRLINES',
  'TRAVEL_PORTAL',
  'STREAMING',
  'ENTERTAINMENT',
  'GAS_STATIONS',
  'DRUGSTORES',
  'HOME_IMPROVEMENT',
  'TRANSIT',
  'DEPARTMENT_STORES',
  'WHOLESALE_CLUBS',
  'GENERAL',
]);
