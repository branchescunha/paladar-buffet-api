export interface ProposalPdfService {
  generate(id: string): Promise<Buffer | null>;
}
