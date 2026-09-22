import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import type { MenuService } from '../../src/modules/menu/menu.service.js';
import type { PaymentMethodService } from '../../src/modules/payment-methods/payment-method.service.js';

const admin = { id: 'admin-1', name: 'Ana', email: 'ana@example.com', role: 'ADMIN' as const, mustChangePassword: false };
const authService = {
  currentSession: vi.fn().mockResolvedValue({ admin }),
  validateCsrf: vi.fn().mockResolvedValue(undefined)
} as unknown as AuthService;

const catalog = [{
  id: 'group-1', name: 'Entradas', minSelections: 1, maxSelections: 1, position: 1, isActive: true,
  sections: [{ id: 'section-1', name: 'Entradas', position: 1, isActive: true, options: [{ id: 'option-1', name: 'Fricassê', position: 1, isActive: true }] }]
}];

function makeMenuService() {
  return {
    getPublicCatalog: vi.fn().mockResolvedValue(catalog),
    getAdminCatalog: vi.fn().mockResolvedValue(catalog),
    createGroup: vi.fn().mockResolvedValue(catalog[0]),
    updateGroup: vi.fn().mockResolvedValue(catalog[0]),
    deleteGroup: vi.fn().mockResolvedValue(true),
    createSection: vi.fn().mockResolvedValue(catalog[0].sections[0]),
    updateSection: vi.fn().mockResolvedValue(catalog[0].sections[0]),
    deleteSection: vi.fn().mockResolvedValue(true),
    createOption: vi.fn().mockResolvedValue(catalog[0].sections[0].options[0]),
    updateOption: vi.fn().mockResolvedValue(catalog[0].sections[0].options[0]),
    deleteOption: vi.fn().mockResolvedValue(true)
  } satisfies MenuService;
}

function makePaymentMethodService() {
  return {
    list: vi.fn().mockResolvedValue([{ id: 'pix', name: 'Pix', instructions: null, pixKey: null, position: 1, isActive: true }]),
    create: vi.fn().mockResolvedValue({ id: 'pix', name: 'Pix', instructions: null, pixKey: null, position: 1, isActive: true }),
    update: vi.fn().mockResolvedValue({ id: 'pix', name: 'Pix', instructions: 'Pagamento identificado', pixKey: 'chave', position: 1, isActive: true }),
    delete: vi.fn().mockResolvedValue(true)
  } satisfies PaymentMethodService;
}

describe('menu and payment method routes', () => {
  it('exposes only the active menu catalog without authentication', async () => {
    const menuService = makeMenuService();
    const response = await request(createApp({ menuService } as never)).get('/menu');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(catalog);
    expect(menuService.getPublicCatalog).toHaveBeenCalledOnce();
  });

  it('protects menu administration and applies CSRF to changes', async () => {
    const menuService = makeMenuService();
    const app = createApp({ authService, menuService } as never);

    const forbidden = await request(app)
      .post('/admin/menu/groups')
      .set('Cookie', 'paladar_admin_session=session-token')
      .send({ name: 'Entradas', minSelections: 1, maxSelections: 1, position: 1, isActive: true });
    const created = await request(app)
      .post('/admin/menu/groups')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ name: 'Entradas', minSelections: 1, maxSelections: 1, position: 1, isActive: true });

    expect(forbidden.status).toBe(403);
    expect(created.status).toBe(201);
    expect(menuService.createGroup).toHaveBeenCalledWith({
      name: 'Entradas', minSelections: 1, maxSelections: 1, position: 1, isActive: true
    });
  });

  it('allows ADMIN to edit, deactivate and remove menu records', async () => {
    const menuService = makeMenuService();
    const app = createApp({ authService, menuService } as never);
    const headers = (requestBuilder: request.Test) => requestBuilder
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    const updated = await headers(request(app).patch('/admin/menu/options/option-1'))
      .send({ sectionId: 'section-1', name: 'Fricassê', position: 2, isActive: false });
    const removed = await headers(request(app).delete('/admin/menu/options/option-1'));

    expect(updated.status).toBe(200);
    expect(menuService.updateOption).toHaveBeenCalledWith('option-1', {
      sectionId: 'section-1', name: 'Fricassê', position: 2, isActive: false
    });
    expect(removed.status).toBe(204);
    expect(menuService.deleteOption).toHaveBeenCalledWith('option-1');
  });

  it('allows ADMIN to manage payment methods with an optional Pix key', async () => {
    const paymentMethodService = makePaymentMethodService();
    const response = await request(createApp({ authService, paymentMethodService } as never))
      .post('/admin/payment-methods')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ name: 'Pix', position: 1, isActive: true });

    expect(response.status).toBe(201);
    expect(paymentMethodService.create).toHaveBeenCalledWith({
      name: 'Pix', instructions: undefined, pixKey: undefined, position: 1, isActive: true
    });
  });

  it('lists, edits, deactivates and removes payment methods', async () => {
    const paymentMethodService = makePaymentMethodService();
    const app = createApp({ authService, paymentMethodService } as never);
    const cookie = ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'];

    const listed = await request(app).get('/admin/payment-methods').set('Cookie', cookie);
    const updated = await request(app)
      .patch('/admin/payment-methods/pix')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'csrf-token')
      .send({ name: 'Pix', instructions: 'Pagamento identificado', pixKey: 'chave', position: 1, isActive: false });
    const removed = await request(app)
      .delete('/admin/payment-methods/pix')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'csrf-token');

    expect(listed.status).toBe(200);
    expect(updated.status).toBe(200);
    expect(paymentMethodService.update).toHaveBeenCalledWith('pix', {
      name: 'Pix', instructions: 'Pagamento identificado', pixKey: 'chave', position: 1, isActive: false
    });
    expect(removed.status).toBe(204);
    expect(paymentMethodService.delete).toHaveBeenCalledWith('pix');
  });
});
