export interface AdminUserManagementService {
  list(): Promise<unknown[]>;
  setActive(id: string, isActive: boolean, actorId: string): Promise<unknown | null>;
  updateOwnProfile(id: string, input: { name: string; commercialTitle: string }): Promise<unknown | null>;
}
