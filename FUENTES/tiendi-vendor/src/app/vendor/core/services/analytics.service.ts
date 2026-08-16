import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import type posthogType from 'posthog-js';

type PostHog = typeof posthogType;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private posthog: PostHog | null = null;

  private async getClient(): Promise<PostHog | null> {
    if (!environment.posthogKey) return null;
    if (!this.posthog) {
      const mod = await import('posthog-js');
      this.posthog = mod.default;
    }
    return this.posthog;
  }

  init(): void {
    if (!environment.posthogKey) return;
    void this.getClient().then((client) => {
      client?.init(environment.posthogKey, {
        api_host: environment.posthogHost,
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false,
        persistence: 'localStorage',
      });
    });
  }

  identify(userId: string, properties?: Record<string, unknown>): void {
    void this.getClient().then((client) => client?.identify(userId, properties));
  }

  reset(): void {
    void this.getClient().then((client) => client?.reset());
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    void this.getClient().then((client) => client?.capture(event, properties));
  }
}
