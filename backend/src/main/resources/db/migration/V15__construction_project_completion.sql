ALTER TABLE construction_projects
  ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE'
  CHECK(status IN ('ACTIVE', 'INACTIVE', 'COMPLETED'));

UPDATE construction_projects
SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END;
