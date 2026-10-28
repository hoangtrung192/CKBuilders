import { loadEnv } from 'vite';
import { createSession } from '../src/lib/client';
export const session = createSession(loadEnv('development', process.cwd(), 'VITE_'));
