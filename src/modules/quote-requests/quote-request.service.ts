import type { QuoteRequestInput } from './quote-request.schemas.js';
import type { AdminQuoteRequestListInput, QuoteRequestStatus } from './admin-quote-request.schemas.js';

export interface QuoteRequestReceipt {
  id: string;
  createdAt: Date;
}

export interface DashboardQuoteRequest {
  id: string;
  fullName: string;
  eventType: string;
  eventTypeOther: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  guestCount: number;
  status: QuoteRequestStatus;
  createdAt: Date;
}

export interface AdminQuoteRequestSummary extends DashboardQuoteRequest {
  email: string | null;
  phone: string;
  location: string | null;
  preferredContact: string;
}

export interface AdminQuoteRequestDetail extends AdminQuoteRequestSummary {
  message: string | null;
  menuPreferences: string[];
  serviceNeeds: string[];
  dietaryRestrictions: string | null;
  acceptedPrivacy: boolean;
  source: string;
  updatedAt: Date;
}

export interface QuoteRequestRepository {
  create(input: Omit<QuoteRequestInput, 'website'>): Promise<QuoteRequestReceipt>;
  listLatest(limit: number): Promise<DashboardQuoteRequest[]>;
  getDashboardMetrics(): Promise<{ newRequests: number; inProgress: number }>;
  listAdmin(input: AdminQuoteRequestListInput): Promise<{ items: AdminQuoteRequestSummary[]; total: number }>;
  findAdminById(id: string): Promise<AdminQuoteRequestDetail | null>;
  updateStatus(id: string, status: QuoteRequestStatus): Promise<{ id: string; status: QuoteRequestStatus } | null>;
}

export interface QuoteRequestService {
  create(input: Omit<QuoteRequestInput, 'website'>): Promise<QuoteRequestReceipt>;
  listLatest(): Promise<DashboardQuoteRequest[]>;
  getDashboardMetrics(): Promise<{ newRequests: number; inProgress: number }>;
  listAdmin(input: AdminQuoteRequestListInput): Promise<{ items: AdminQuoteRequestSummary[]; total: number }>;
  findAdminById(id: string): Promise<AdminQuoteRequestDetail | null>;
  updateStatus(id: string, status: QuoteRequestStatus): Promise<{ id: string; status: QuoteRequestStatus } | null>;
}

export class DefaultQuoteRequestService implements QuoteRequestService {
  constructor(private readonly repository: QuoteRequestRepository) {}

  create(input: Omit<QuoteRequestInput, 'website'>) {
    return this.repository.create(input);
  }

  listLatest() {
    return this.repository.listLatest(5);
  }

  getDashboardMetrics() {
    return this.repository.getDashboardMetrics();
  }

  listAdmin(input: AdminQuoteRequestListInput) {
    return this.repository.listAdmin(input);
  }

  findAdminById(id: string) {
    return this.repository.findAdminById(id);
  }

  updateStatus(id: string, status: QuoteRequestStatus) {
    return this.repository.updateStatus(id, status);
  }
}
