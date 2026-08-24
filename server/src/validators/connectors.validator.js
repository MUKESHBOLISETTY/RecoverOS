import { z } from 'zod';

export const saveConnectionSchema = z.object({
  connectorId: z.string().min(1, 'Connector ID is required'),
  name: z.string().min(1, 'Name is required'),
  credentials: z.record(z.any(), 'Credentials must be an object')
});
