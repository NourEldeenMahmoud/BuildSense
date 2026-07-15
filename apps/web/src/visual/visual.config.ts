import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { API_BASE_URL } from '../app/core/api.config';
import { visualRoutes } from './visual.routes';

export const visualAppConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(visualRoutes),
    provideHttpClient(withFetch()),
    { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
  ],
};
