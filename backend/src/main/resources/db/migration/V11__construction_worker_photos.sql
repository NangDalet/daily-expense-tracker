ALTER TABLE construction_workers ADD COLUMN photo_data_url TEXT;
ALTER TABLE construction_workers ADD CONSTRAINT construction_worker_photo_size
    CHECK (photo_data_url IS NULL OR length(photo_data_url) <= 350000);
