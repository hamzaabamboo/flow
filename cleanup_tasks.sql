-- Delete duplicate task records that have a parentTaskId (these are the wrongly created instances)
DELETE FROM tasks WHERE parent_task_id IS NOT NULL;

-- Create the task_completions table for tracking per-date completions
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(task_id, completed_date)  -- Ensure one completion per task per date
);
