export type RiderStatus =
  | 'PENDING_DOCUMENTS'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SUSPENDED';

export interface Rider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: RiderStatus;
  ratingAvg: number | null;
  vehicleType: string;
  avatarUrl: string | null;
}
