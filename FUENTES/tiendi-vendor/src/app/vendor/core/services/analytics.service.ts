import { Injectable } from '@angular/core';
import posthog from 'posthog-js';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  init(): void {
    if (!environment.posthogKey) return;
    posthog.init(environment.posthogKey, {
      api_host: environment.posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: 'localStorage',
    });
  }

  identify(userId: string, properties?: Record<string, unknown>): void {
    posthog.identify(userId, properties);
  }

  reset(): void {
    posthog.reset();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    posthog.capture(event, properties);
  }
}
