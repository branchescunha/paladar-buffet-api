import { ApiError } from '../../shared/errors.js';

export interface PaymentScheduleInput {
  description: string;
  percentage: number;
}

const validationError = (message: string) => new ApiError(400, message, 'VALIDATION_ERROR');

export function calculatePerGuestTotals(input: {
  guestCount: number;
  pricePerGuestCents: number;
  adjustmentCents: number;
}) {
  const baseTotalCents = input.guestCount * input.pricePerGuestCents;
  const totalCents = baseTotalCents + input.adjustmentCents;

  if (!Number.isSafeInteger(baseTotalCents) || baseTotalCents < 0 || baseTotalCents > 2147483647) {
    throw validationError('Valor base da proposta excede o limite permitido.');
  }
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 2147483647) {
    throw validationError('Total da proposta inválido.');
  }

  return { baseTotalCents, totalCents };
}

export function defaultPaymentSchedule(): PaymentScheduleInput[] {
  return [
    { description: 'Na contratação', percentage: 50 },
    { description: 'No dia do evento', percentage: 50 }
  ];
}

export function validatePaymentSchedule(schedule: PaymentScheduleInput[]) {
  const total = schedule.reduce((sum, installment) => sum + installment.percentage, 0);
  if (total !== 100) {
    throw validationError('Os percentuais de pagamento devem totalizar 100%.');
  }
}

export function calculatePaymentAmounts(totalCents: number, schedule: PaymentScheduleInput[]) {
  validatePaymentSchedule(schedule);
  let allocatedCents = 0;

  return schedule.map((installment, index) => {
    const amountCents = index === schedule.length - 1
      ? totalCents - allocatedCents
      : Math.floor((totalCents * installment.percentage) / 100);
    allocatedCents += amountCents;
    return { ...installment, amountCents };
  });
}

export function defaultProposalValidity(from = new Date()) {
  return new Date(from.getTime() + 15 * 24 * 60 * 60 * 1000);
}
