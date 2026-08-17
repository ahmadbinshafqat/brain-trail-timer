import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { computeDistanceKm } from './geo';

const databasePath = process.env.DATABASE_PATH || './data/trail_timer.sqlite';
const databaseDir = path.dirname(databasePath);
fs.mkdirSync(databaseDir, { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export type RouteRecord = {
  id: number;
  name: string;
  polylineOrGeoJSON: string;
  distanceKm: number;
  elevationGainM: number;
  createdAt: string;
};

export type EstimateRecord = {
  id: number;
  routeId: number;
  paceMinPerKm: number;
  stopMinutes: number;
  totalMinutes: number;
  breakdownJson: string;
  createdAt: string;
};

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      polylineOrGeoJSON TEXT NOT NULL,
      distanceKm REAL NOT NULL,
      elevationGainM REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routeId INTEGER NOT NULL,
      paceMinPerKm REAL NOT NULL,
      stopMinutes REAL NOT NULL,
      totalMinutes REAL NOT NULL,
      breakdownJson TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(routeId) REFERENCES routes(id) ON DELETE CASCADE
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as count FROM routes').get() as { count: number };
  if (count.count === 0) {
    const sample = {
      type: 'Feature',
      properties: { name: 'Sample Ridge Walk' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.4862, 37.8324],
          [-122.4815, 37.8339],
          [-122.4761, 37.8328],
          [-122.4706, 37.8299],
          [-122.4663, 37.8268]
        ]
      }
    };
    const distanceKm = computeDistanceKm(sample);
    db.prepare(`
      INSERT INTO routes (name, polylineOrGeoJSON, distanceKm, elevationGainM)
      VALUES (@name, @polylineOrGeoJSON, @distanceKm, @elevationGainM)
    `).run({
      name: 'Sample Ridge Walk',
      polylineOrGeoJSON: JSON.stringify(sample),
      distanceKm,
      elevationGainM: 180
    });
  }
}
