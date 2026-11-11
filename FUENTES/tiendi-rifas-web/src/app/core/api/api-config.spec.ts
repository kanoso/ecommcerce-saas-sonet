import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { GOOGLE_CLIENT_ID } from './api-config';

describe('GOOGLE_CLIENT_ID', () => {
  it('resolves to the client id configured in the environment', () => {
    expect(TestBed.inject(GOOGLE_CLIENT_ID)).toBe(environment.googleClientId);
  });

  it('is configured with a Google OAuth web client id', () => {
    expect(environment.googleClientId).toMatch(
      /\.apps\.googleusercontent\.com$/,
    );
  });
});
