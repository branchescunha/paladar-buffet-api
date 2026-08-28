import { describe, expect, it } from 'vitest';
import { quoteRequestSchema } from '../../src/modules/quote-requests/quote-request.schemas.js';

const validInput = {
  fullName: 'Andre Vinicius',
  email: 'andre@example.com',
  phone: '(61) 98416-3455',
  eventType: 'casamento',
  eventDate: '2099-09-20',
  guestCount: 120,
  location: 'Brasilia-DF',
  message: 'Gostaria de um buffet completo para casamento.',
  preferredContact: 'whatsapp',
  acceptedPrivacy: true
};

describe('quoteRequestSchema', () => {
  it('normalizes safe public quote request input', () => {
    const parsed = quoteRequestSchema.parse(validInput);

    expect(parsed).toMatchObject({
      fullName: 'Andre Vinicius',
      email: 'andre@example.com',
      phone: '61984163455',
      eventType: 'casamento',
      guestCount: 120,
      acceptedPrivacy: true
    });
  });

  it('requires explicit privacy acceptance', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, acceptedPrivacy: false })).toThrow();
  });

  it('requires a positive guest count', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, guestCount: 0 })).toThrow();
  });

  it('requires details when event type is other', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, eventType: 'outro', eventTypeOther: '' })).toThrow();
    expect(quoteRequestSchema.parse({ ...validInput, eventType: 'outro', eventTypeOther: 'Formatura' }).eventTypeOther).toBe(
      'Formatura'
    );
  });

  it('rejects past event dates', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, eventDate: '2020-01-01' })).toThrow();
  });
});
