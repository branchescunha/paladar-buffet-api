export interface AdminUserManagementService {
  list(): Promise<unknown[]>;
  setActive(id: string, isActive: boolean): Promise<unknown | null>;
  updateOwnName(id: string, name: string): Promise<unknown | null>;
}
