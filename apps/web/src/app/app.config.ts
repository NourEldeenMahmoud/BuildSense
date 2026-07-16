import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { API_BASE_URL } from './core/api.config';
import { routes } from './app.routes';
import { csrfInterceptor } from './features/admin/core/interceptors/csrf.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor])),
    { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
  ],
};
