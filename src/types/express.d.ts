import type { AdminUser } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      admin?: Pick<AdminUser, 'id' | 'name' | 'email' | 'role' | 'avatarUrl' | 'mustChangePassword'>;
    }
  }
}
