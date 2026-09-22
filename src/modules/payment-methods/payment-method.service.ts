import type { PaymentMethodInput } from './payment-method.schemas.js';

export interface PaymentMethodService {
  list(): Promise<unknown[]>;
  create(input: PaymentMethodInput): Promise<unknown>;
  update(id: string, input: PaymentMethodInput): Promise<unknown | null>;
  delete(id: string): Promise<boolean>;
}
