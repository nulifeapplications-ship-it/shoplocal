CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX login_attempts_expiry ON login_attempts(expires);
