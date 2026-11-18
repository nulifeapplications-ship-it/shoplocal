CREATE TABLE stores (
 id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', areas TEXT NOT NULL DEFAULT '', hours TEXT NOT NULL DEFAULT '', fee INTEGER, instructions TEXT NOT NULL DEFAULT '', logo TEXT, approved INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','vendor')), store TEXT UNIQUE REFERENCES stores(id));
CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE invites (token TEXT PRIMARY KEY, store TEXT NOT NULL REFERENCES stores(id), expires INTEGER NOT NULL, claim TEXT);
CREATE TABLE media (id TEXT PRIMARY KEY, store TEXT NOT NULL REFERENCES stores(id), mime TEXT NOT NULL, data BLOB NOT NULL);
CREATE TABLE products (
 id TEXT PRIMARY KEY, store TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', cents INTEGER NOT NULL, unit TEXT NOT NULL CHECK(unit IN ('unit','package','lb')), pack TEXT NOT NULL DEFAULT '', photo TEXT, hidden INTEGER NOT NULL DEFAULT 0, soldout INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, UNIQUE(store,code)
);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, store TEXT NOT NULL REFERENCES stores(id), guest TEXT NOT NULL, phone TEXT NOT NULL, property TEXT NOT NULL, room TEXT NOT NULL, delivery_date TEXT NOT NULL, delivery_time TEXT NOT NULL, notes TEXT NOT NULL, fee INTEGER, status TEXT NOT NULL DEFAULT 'new', items TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, attempt TEXT NOT NULL UNIQUE
);
CREATE INDEX orders_store ON orders(store,created);
CREATE INDEX orders_created ON orders(created);
CREATE INDEX media_store ON media(store);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE INDEX invites_store ON invites(store);
