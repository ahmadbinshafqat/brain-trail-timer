import { Router } from 'express';
import { z } from 'zod';
import { db, RouteRecord } from './db';
import { computeDistanceKm } from './geo';
import { calculateEstimate } from './estimate';

export const apiRouter = Router();

const routeSchema = z.object({
  name: z.string().min(1).max(120),
  geojson: z.unknown(),
  elevationGainM: z.coerce.number().min(0).max(10000).default(0)
});

const estimateSchema = z.object({
  routeId: z.coerce.number().int().positive(),
  paceMinPerKm: z.coerce.number().min(1).max(60),
  stopMinutes: z.coerce.number().min(0).max(2000).default(0)
});

apiRouter.get('/routes', (_req, res) => {
  const routes = db.prepare(`
    SELECT r.*, e.totalMinutes as latestTotalMinutes
    FROM routes r
    LEFT JOIN estimates e ON e.id = (
      SELECT id FROM estimates WHERE routeId = r.id ORDER BY createdAt DESC, id DESC LIMIT 1
    )
    ORDER BY r.createdAt DESC, r.id DESC
    LIMIT 20
  `).all();
  res.json({ routes });
});

apiRouter.post('/routes', (req, res) => {
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const distanceKm = computeDistanceKm(parsed.data.geojson);
    if (distanceKm <= 0) return res.status(400).json({ error: 'Route must contain at least two valid points.' });

    const result = db.prepare(`
      INSERT INTO routes (name, polylineOrGeoJSON, distanceKm, elevationGainM)
      VALUES (@name, @polylineOrGeoJSON, @distanceKm, @elevationGainM)
    `).run({
      name: parsed.data.name,
      polylineOrGeoJSON: JSON.stringify(parsed.data.geojson),
      distanceKm,
      elevationGainM: parsed.data.elevationGainM
    });

    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(result.lastInsertRowid) as RouteRecord;
    res.status(201).json({ route });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid route data.' });
  }
});

apiRouter.post('/estimates', (req, res) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(parsed.data.routeId) as RouteRecord | undefined;
  if (!route) return res.status(404).json({ error: 'Route not found.' });

  const breakdown = calculateEstimate({
    distanceKm: route.distanceKm,
    elevationGainM: route.elevationGainM,
    paceMinPerKm: parsed.data.paceMinPerKm,
    stopMinutes: parsed.data.stopMinutes
  });

  const result = db.prepare(`
    INSERT INTO estimates (routeId, paceMinPerKm, stopMinutes, totalMinutes, breakdownJson)
    VALUES (@routeId, @paceMinPerKm, @stopMinutes, @totalMinutes, @breakdownJson)
  `).run({
    routeId: route.id,
    paceMinPerKm: parsed.data.paceMinPerKm,
    stopMinutes: parsed.data.stopMinutes,
    totalMinutes: breakdown.totalMinutes,
    breakdownJson: JSON.stringify(breakdown)
  });

  const estimate = db.prepare('SELECT * FROM estimates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ estimate, route, breakdown });
});
