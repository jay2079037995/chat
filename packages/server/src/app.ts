import express, { type Express } from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';

const app: Express = express();

app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

export { app };
