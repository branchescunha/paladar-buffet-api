import type { CustomerInput, EventInput, EventStatus, EventUpdate } from './crm.schemas.js';

export interface CustomerService {
  list(search?: string): Promise<unknown[]>;
  create(input: CustomerInput): Promise<unknown>;
  findById(id: string): Promise<unknown | null>;
  update(id: string, input: Partial<CustomerInput>): Promise<unknown | null>;
}

export interface EventService {
  list(input: { search?: string; status?: EventStatus }): Promise<unknown[]>;
  create(input: EventInput): Promise<unknown>;
  findById(id: string): Promise<unknown | null>;
  update(id: string, input: EventUpdate): Promise<unknown | null>;
  countConfirmed(): Promise<number>;
}

export interface QuoteConversionService {
  convert(id: string, input: { customerId?: string; customerNotes?: string; eventNotes?: string }): Promise<unknown | null>;
}
