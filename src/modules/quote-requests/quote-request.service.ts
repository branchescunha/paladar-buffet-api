import type { QuoteRequestInput } from './quote-request.schemas.js';

export interface QuoteRequestReceipt {
  id: string;
  createdAt: Date;
}

export interface QuoteRequestRepository {
  create(input: Omit<QuoteRequestInput, 'website'>): Promise<QuoteRequestReceipt>;
}

export interface QuoteRequestService {
  create(input: Omit<QuoteRequestInput, 'website'>): Promise<QuoteRequestReceipt>;
}

export class DefaultQuoteRequestService implements QuoteRequestService {
  constructor(private readonly repository: QuoteRequestRepository) {}

  create(input: Omit<QuoteRequestInput, 'website'>) {
    return this.repository.create(input);
  }
}
