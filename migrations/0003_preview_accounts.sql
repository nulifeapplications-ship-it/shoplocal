ALTER TABLE users ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;
UPDATE users SET demo=1 WHERE email LIKE '%@nulife-preview.test';
UPDATE stores SET demo=1 WHERE id IN (SELECT store FROM users WHERE demo=1 AND store IS NOT NULL);
