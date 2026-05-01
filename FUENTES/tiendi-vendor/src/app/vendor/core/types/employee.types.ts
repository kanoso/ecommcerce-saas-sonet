import { Role } from './user.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface StoreEmployee {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  email: string;
  role: Exclude<Role, 'CUSTOMER'>;
  status: EmployeeStatus;
  avatar: string | null;
  invitedAt: string;
  joinedAt: string | null;
  lastActiveAt: string | null;
}
