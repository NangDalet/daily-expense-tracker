ALTER TABLE construction_projects
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE,
  ADD COLUMN planned_amount NUMERIC(16,2),
  ADD CONSTRAINT construction_project_dates CHECK (
    (start_date IS NULL AND end_date IS NULL) OR
    (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  ),
  ADD CONSTRAINT construction_project_amount CHECK (planned_amount >= 0);
