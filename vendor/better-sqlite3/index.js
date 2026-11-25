"use strict";
// Minimal better-sqlite3-compatible API on top of Node's built-in `node:sqlite`.
// It covers what drizzle-orm and drizzle-kit use, so the app needs no native
// module and no compiler on Windows/macOS, whatever the Node version.

// Silence the "SQLite is an experimental feature" warning on older Node versions
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const text = typeof warning === "string" ? warning : warning && warning.message;
  if (text && text.includes("SQLite is an experimental feature")) return;
  return emitWarning.call(process, warning, ...rest);
};
const { DatabaseSync } = require("node:sqlite");
process.emitWarning = emitWarning;

function toParam(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function bind(args) {
  // better-sqlite3 accepts a single named-parameter object or positional values
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !ArrayBuffer.isView(args[0]) && !Array.isArray(args[0])) {
    const out = {};
    for (const [k, v] of Object.entries(args[0])) out[k] = toParam(v);
    return [out];
  }
  return args.flat().map(toParam);
}

class Statement {
  constructor(db, source) {
    this.database = db;
    this.source = source;
    this._stmt = db._db.prepare(source);
    this._raw = false;
    this._bound = null;
  }
  // Permanently binds parameters, like better-sqlite3's Statement#bind
  bind(...args) {
    this._bound = bind(args);
    return this;
  }
  _args(args) {
    return this._bound && args.length === 0 ? this._bound : bind(args);
  }
  get reader() {
    return this._stmt.columns().length > 0;
  }
  raw(toggle = true) {
    this._raw = Boolean(toggle);
    this._stmt.setReturnArrays(this._raw);
    return this;
  }
  pluck() {
    throw new Error("pluck() is not supported by the node:sqlite wrapper");
  }
  run(...args) {
    const r = this._stmt.run(...this._args(args));
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }
  get(...args) {
    return this._stmt.get(...this._args(args));
  }
  all(...args) {
    return this._stmt.all(...this._args(args));
  }
  iterate(...args) {
    return this._stmt.iterate(...this._args(args));
  }
  columns() {
    return this._stmt.columns();
  }
}

class Database {
  constructor(filename = ":memory:", options = {}) {
    this.name = filename;
    // better-sqlite3 waits up to 5 s on a locked database by default
    this._db = new DatabaseSync(filename, { readOnly: Boolean(options.readonly), timeout: options.timeout ?? 5000 });
    this._depth = 0;
    this.open = true;
  }
  get inTransaction() {
    return this._depth > 0;
  }
  prepare(source) {
    return new Statement(this, source);
  }
  exec(source) {
    this._db.exec(source);
    return this;
  }
  pragma(source, options = {}) {
    const rows = this._db.prepare(`PRAGMA ${source}`).all();
    if (options.simple) {
      const first = rows[0];
      return first ? Object.values(first)[0] : undefined;
    }
    return rows;
  }
  transaction(fn) {
    const db = this;
    const make = (mode) =>
      function (...args) {
        // Nested transactions use savepoints, like better-sqlite3
        const nested = db._depth > 0;
        const sp = `bs3_sp_${db._depth}`;
        db._db.exec(nested ? `SAVEPOINT ${sp}` : `BEGIN ${mode}`);
        db._depth++;
        try {
          const result = fn.apply(this, args);
          if (result && typeof result.then === "function") {
            throw new TypeError("Transaction function cannot return a promise");
          }
          db._depth--;
          db._db.exec(nested ? `RELEASE ${sp}` : "COMMIT");
          return result;
        } catch (err) {
          db._depth--;
          if (nested) {
            db._db.exec(`ROLLBACK TO ${sp}`);
            db._db.exec(`RELEASE ${sp}`);
          } else if (db._db.isTransaction) {
            db._db.exec("ROLLBACK");
          }
          throw err;
        }
      };
    const tx = make("DEFERRED");
    tx.deferred = make("DEFERRED");
    tx.immediate = make("IMMEDIATE");
    tx.exclusive = make("EXCLUSIVE");
    tx.default = tx;
    return tx;
  }
  close() {
    this._db.close();
    this.open = false;
    return this;
  }
}

module.exports = Database;
module.exports.default = Database;
module.exports.Database = Database;
