// Filter related types

export interface FilterOptions {
  search?: string;
  priority?: string;
  label?: string;
  labels?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  dueBefore?: string;
  dueAfter?: string;
  completed?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
