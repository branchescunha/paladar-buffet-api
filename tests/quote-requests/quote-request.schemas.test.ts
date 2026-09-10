import { describe, expect, it } from 'vitest';
import { quoteRequestSchema } from '../../src/modules/quote-requests/quote-request.schemas.js';

const validInput = {
  fullName: 'Andre Vinicius',
  email: 'andre@example.com',
  phone: '(61) 98416-3455',
  eventType: 'casamento',
  eventDate: '2099-09-20',
  eventTime: '19:30',
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
      eventTime: '19:30',
      guestCount: 120,
      acceptedPrivacy: true
    });
  });

  it('accepts and normalizes fixed line, mobile and country-prefixed Brazilian phone numbers', () => {
    expect(quoteRequestSchema.parse({ ...validInput, phone: '(61) 98416-3455' }).phone).toBe('61984163455');
    expect(quoteRequestSchema.parse({ ...validInput, phone: '(61) 3333-4444' }).phone).toBe('6133334444');
    expect(quoteRequestSchema.parse({ ...validInput, phone: '+55 61 98416-3455' }).phone).toBe('61984163455');
  });

  it('rejects invalid, textual and oversized phone numbers', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, phone: '6198416345' })).toThrow('Telefone inválido.');
    expect(() => quoteRequestSchema.parse({ ...validInput, phone: 'abc123456789' })).toThrow('Telefone inválido.');
    expect(() => quoteRequestSchema.parse({ ...validInput, phone: '1'.repeat(200) })).toThrow();
  });

  it('requires an expected event time', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, eventTime: '' })).toThrow();
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

  it('rejects unexpected payload fields before persistence', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, status: 'approved' })).toThrow();
  });

  it('accepts only mapped menu preferences and service needs', () => {
    expect(() => quoteRequestSchema.parse({ ...validInput, menuPreferences: ['jantar', 'sql-admin'] })).toThrow();
    expect(() => quoteRequestSchema.parse({ ...validInput, serviceNeeds: ['garcons', 'debug-access'] })).toThrow();
    expect(() =>
      quoteRequestSchema.parse({
        ...validInput,
        menuPreferences: ['jantar', 'churrasco', 'coffee-break', 'brunch', 'sobremesas', 'extra'],
        serviceNeeds: ['garcons', 'loucas', 'montagem', 'bebidas', 'extra']
      })
    ).toThrow();
  });

  it('does not retain other event detail for mapped event types', () => {
    expect(quoteRequestSchema.parse({ ...validInput, eventTypeOther: 'Nao deveria persistir' }).eventTypeOther).toBeUndefined();
  });

  it('keeps legitimate text characters without treating them as SQL or HTML syntax', () => {
    const parsed = quoteRequestSchema.parse({
      ...validInput,
      fullName: "Ana Paula D'Avila-Santos",
      message: "Mesa infantil com tema <script>alert('x')</script> e item O'Brien."
    });

    expect(parsed.fullName).toBe("Ana Paula D'Avila-Santos");
    expect(parsed.message).toContain("<script>alert('x')</script>");
  });
});
