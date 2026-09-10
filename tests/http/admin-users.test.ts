import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';

function makeAuthService(role: 'OWNER' | 'ADMIN') {
  return {
    currentSession: vi.fn().mockResolvedValue({
      admin: { id: 'owner-1', name: 'Mauri', email: 'owner@paladarbuffet.com', role, mustChangePassword: false }
    }),
    validateCsrf: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuthService;
}

describe('admin user management routes', () => {
  it('lists administrative users for OWNER only', async () => {
    const adminUserService = {
      list: vi.fn().mockResolvedValue([{ id: 'admin-1', name: 'Ana', email: 'ana@paladarbuffet.com', role: 'ADMIN', isActive: true }]),
      setActive: vi.fn(),
      updateOwnName: vi.fn()
    };

    const ownerResponse = await request(createApp({ authService: makeAuthService('OWNER'), adminUserService } as never))
      .get('/admin/users')
      .set('Cookie', 'paladar_admin_session=session-token');
    const adminResponse = await request(createApp({ authService: makeAuthService('ADMIN'), adminUserService } as never))
      .get('/admin/users')
      .set('Cookie', 'paladar_admin_session=session-token');

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toEqual([{ id: 'admin-1', name: 'Ana', email: 'ana@paladarbuffet.com', role: 'ADMIN', isActive: true }]);
    expect(adminResponse.status).toBe(403);
  });

  it('changes an ADMIN activity state through the OWNER-only route', async () => {
    const adminUserService = {
      list: vi.fn(),
      setActive: vi.fn().mockResolvedValue({ id: 'admin-1', name: 'Ana', email: 'ana@paladarbuffet.com', role: 'ADMIN', isActive: false }),
      updateOwnName: vi.fn()
    };

    const response = await request(createApp({ authService: makeAuthService('OWNER'), adminUserService } as never))
      .patch('/admin/users/admin-1/active')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'admin-1', isActive: false });
    expect(adminUserService.setActive).toHaveBeenCalledWith('admin-1', false);
  });

  it('updates only the authenticated administrator name', async () => {
    const adminUserService = {
      list: vi.fn(),
      setActive: vi.fn(),
      updateOwnName: vi.fn().mockResolvedValue({ id: 'owner-1', name: 'Mauri Anderson', email: 'owner@paladarbuffet.com', role: 'OWNER', isActive: true })
    };

    const response = await request(createApp({ authService: makeAuthService('OWNER'), adminUserService } as never))
      .patch('/admin/users/profile')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ name: 'Mauri Anderson' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'owner-1', name: 'Mauri Anderson' });
    expect(adminUserService.updateOwnName).toHaveBeenCalledWith('owner-1', 'Mauri Anderson');
  });
});
