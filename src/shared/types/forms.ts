import type { Task } from './board';

export type TaskFormData = Omit<Partial<Task>, 'id'> & {
  id: string;
};
