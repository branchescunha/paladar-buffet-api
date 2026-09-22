import type { ProposalInput, ProposalStatus } from './proposal.schemas.js';

export interface ProposalService {
  list(input: { search?: string; status?: ProposalStatus }): Promise<unknown>;
  findById(id: string): Promise<unknown | null>;
  create(input: ProposalInput, responsibleAdminId?: string): Promise<unknown>;
  update(id: string, input: ProposalInput): Promise<unknown | null>;
  updateStatus(id: string, status: ProposalStatus): Promise<unknown | null>;
  delete(id: string): Promise<boolean>;
  createDraftFromQuote(quoteRequestId: string, responsibleAdminId?: string): Promise<unknown | null>;
  countSent(): Promise<number>;
}
