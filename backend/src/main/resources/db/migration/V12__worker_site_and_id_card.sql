ALTER TABLE construction_workers
    ADD COLUMN project_id UUID REFERENCES construction_projects(id),
    ADD COLUMN id_card_data_url TEXT;

CREATE INDEX idx_construction_workers_project ON construction_workers(project_id);
ALTER TABLE construction_workers ADD CONSTRAINT construction_worker_id_card_size
    CHECK (id_card_data_url IS NULL OR length(id_card_data_url) <= 2000000);
