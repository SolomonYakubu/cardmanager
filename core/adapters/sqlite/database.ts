import Database from 'better-sqlite3'
import type { Database as SqliteDatabase } from 'better-sqlite3'

export class SQLiteDatabase {
  readonly db: SqliteDatabase

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        hospitalNo TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        dateOfBirth TEXT NOT NULL,
        emrReference TEXT NOT NULL,
        walletNo TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        cardId TEXT NOT NULL UNIQUE,
        patientId TEXT NOT NULL,
        hospitalNo TEXT NOT NULL,
        nfcUid TEXT,
        originalityCode TEXT NOT NULL,
        status TEXT NOT NULL,
        issuedAt TEXT,
        issuedByOperatorId TEXT,
        expiresAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS card_events (
        id TEXT PRIMARY KEY,
        cardRecordId TEXT NOT NULL,
        type TEXT NOT NULL,
        operatorId TEXT,
        stationId TEXT,
        detail TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (cardRecordId) REFERENCES cards(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS designs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        frontBackground TEXT,
        backBackground TEXT,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      );
    `)
  }

  close() {
    this.db.close()
  }
}
