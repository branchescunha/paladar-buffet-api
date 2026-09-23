import { describe, expect, it } from 'vitest';
import {
  calculatePaymentAmounts,
  calculatePerGuestTotals,
  defaultPaymentSchedule,
  defaultProposalValidity,
  validatePaymentSchedule
} from '../../src/modules/proposals/proposal-commercial.js';

describe('proposal commercial model', () => {
  it('calculates the base and final totals from guests and price per guest', () => {
    expect(calculatePerGuestTotals({ guestCount: 120, pricePerGuestCents: 18990, adjustmentCents: -50000 })).toEqual({
      baseTotalCents: 2278800,
      totalCents: 2228800
    });
    expect(calculatePerGuestTotals({ guestCount: 80, pricePerGuestCents: 12990, adjustmentCents: 25000 })).toEqual({
      baseTotalCents: 1039200,
      totalCents: 1064200
    });
  });

  it('provides an editable default 50/50 schedule', () => {
    expect(defaultPaymentSchedule()).toEqual([
      { description: 'Na contratação', percentage: 50 },
      { description: 'No dia do evento', percentage: 50 }
    ]);
    expect(validatePaymentSchedule([
      { description: 'Reserva', percentage: 40 },
      { description: 'Antes do evento', percentage: 60 }
    ])).toBeUndefined();
  });

  it('rejects payment schedules whose percentages do not total 100', () => {
    expect(() => validatePaymentSchedule([
      { description: 'Reserva', percentage: 40 },
      { description: 'Evento', percentage: 50 }
    ])).toThrow('Os percentuais de pagamento devem totalizar 100%.');
  });

  it('calculates installment amounts over the final total and assigns the rounding remainder to the last installment', () => {
    expect(calculatePaymentAmounts(10001, [
      { description: 'Na contratação', percentage: 50 },
      { description: 'No dia do evento', percentage: 50 }
    ])).toEqual([
      { description: 'Na contratação', percentage: 50, amountCents: 5000 },
      { description: 'No dia do evento', percentage: 50, amountCents: 5001 }
    ]);
  });

  it('defaults proposal validity to 15 calendar days', () => {
    expect(defaultProposalValidity(new Date('2026-09-22T12:00:00.000Z'))).toEqual(new Date('2026-10-07T12:00:00.000Z'));
  });
});
