ALTER TABLE construction_access ADD COLUMN construction_role VARCHAR(16) NOT NULL DEFAULT 'MANAGER'
  CHECK (construction_role IN ('MANAGER', 'FOREMAN'));
CREATE TABLE construction_foreman_sites (
  user_id UUID NOT NULL REFERENCES construction_access(user_id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES construction_projects(id),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE construction_access_history ADD COLUMN construction_role VARCHAR(16);
ALTER TABLE construction_access_history ADD COLUMN site_ids UUID[];
