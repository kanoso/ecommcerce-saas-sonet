import { execSync } from 'child_process';
import * as path from 'path';
import './setup-integration';

/**
 * Applies the real migrations, triggers included. If the database is
 * unreachable this throws, so the whole run fails instead of skipping.
 */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
