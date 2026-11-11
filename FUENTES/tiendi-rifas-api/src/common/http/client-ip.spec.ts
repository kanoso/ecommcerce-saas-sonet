import express from 'express';
import request from 'supertest';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';
import { parseTrustProxy } from './client-ip';

type Tracker = { getTracker(req: Record<string, unknown>): Promise<string> };

describe('client IP (F6)', () => {
  const guard = Object.create(ClientIpThrottlerGuard.prototype) as Tracker;

  it('tracks req.ip only, whatever the headers say', async () => {
    const spoofed = {
      ip: '198.51.100.20',
      headers: {
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8, 9.9.9.9',
      },
    };

    await expect(guard.getTracker(spoofed)).resolves.toBe('198.51.100.20');
  });

  describe('TRUST_PROXY', () => {
    it('reads a hop count as a number and a list as it is', () => {
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('10.0.0.0/8, 173.245.48.0/20')).toBe('10.0.0.0/8, 173.245.48.0/20');
    });

    it('refuses to trust every proxy', () => {
      expect(() => parseTrustProxy('true')).toThrow();
      expect(() => parseTrustProxy('')).toThrow();
    });

    async function ipSeenWith(trust: string, headers: Record<string, string>) {
      const app = express();
      app.set('trust proxy', parseTrustProxy(trust));
      app.get('/', (req, res) => {
        res.send(req.ip);
      });
      let call = request(app).get('/');
      for (const [name, value] of Object.entries(headers)) {
        call = call.set(name, value);
      }
      return (await call).text;
    }

    it('ignores X-Forwarded-For from a peer that is not a trusted proxy', async () => {
      const ip = await ipSeenWith('10.0.0.0/8', { 'X-Forwarded-For': '5.6.7.8' });

      expect(ip).not.toBe('5.6.7.8');
    });

    it('takes the forwarded client from a trusted proxy', async () => {
      const ip = await ipSeenWith('loopback', { 'X-Forwarded-For': '5.6.7.8' });

      expect(ip).toBe('5.6.7.8');
    });

    it('never takes CF-Connecting-IP, even from a trusted proxy', async () => {
      const ip = await ipSeenWith('loopback', { 'CF-Connecting-IP': '1.2.3.4' });

      expect(ip).not.toBe('1.2.3.4');
    });
  });
});
