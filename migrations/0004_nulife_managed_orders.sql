ALTER TABLE stores ADD COLUMN nulife_managed INTEGER NOT NULL DEFAULT 0 CHECK (nulife_managed IN (0,1));
ALTER TABLE stores ADD COLUMN managed_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN nulife_managed INTEGER NOT NULL DEFAULT 0 CHECK (nulife_managed IN (0,1));
ALTER TABLE orders ADD COLUMN managed_contact TEXT NOT NULL DEFAULT '';
