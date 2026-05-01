export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  details?: Record<string, string[]>;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DateRange {
  from: string; // ISO 8601
  to: string;   // ISO 8601
}
