import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const toSQLite = value => value instanceof ArrayBuffer ? new Uint8Array(value) : value;
export function createDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
  const directory = new URL('migrations/',import.meta.url);
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort()) {
    const name=file.slice(0,-4);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!db.prepare('SELECT name FROM migrations WHERE name=?').get(name)) {
        db.exec(readFileSync(new URL(file,directory),'utf8'));
        db.prepare('INSERT INTO migrations VALUES (?)').run(name);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  function statement(sql, values = []) {
    const prepared = db.prepare(sql);
    return {
      bind: (...args) => statement(sql,args),
      first: async () => prepared.get(...values.map(toSQLite)) ?? null,
      all: async () => ({results:prepared.all(...values.map(toSQLite))}),
      run: async () => ({meta:{changes:prepared.run(...values.map(toSQLite)).changes}}),
      execute: () => {
        if (prepared.columns().length) return {results:prepared.all(...values.map(toSQLite))};
        return {meta:{changes:prepared.run(...values.map(toSQLite)).changes}};
      }
    };
  }
  return {
    prepare: statement,
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(entry=>entry.execute());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
