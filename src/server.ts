import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { initDb } from './db';
import { apiRouter } from './routes';

initDb();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'Trail Timer' });
});

app.listen(port, () => {
  console.log(`Trail Timer running at http://localhost:${port}`);
});
