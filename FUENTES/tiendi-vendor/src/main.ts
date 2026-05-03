/**
 * Bootstrap entry point for tiendi-vendor Angular application.
 * Initializes the Angular standalone bootstrap using the app configuration.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
