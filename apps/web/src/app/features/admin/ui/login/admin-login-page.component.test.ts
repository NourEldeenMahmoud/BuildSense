import { describe, expect, it, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminLoginPage } from './admin-login-page.component';

describe('AdminLoginPage', () => {
  let fixture: ComponentFixture<AdminLoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoginPage);
    fixture.detectChanges();
  });

  it('renders the BuildSense title', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.login-title')?.textContent).toContain('BuildSense');
  });

  it('renders the Admin Console subtitle', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.login-subtitle')?.textContent).toContain('Admin Console');
  });

  it('renders email and password inputs', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#login-email')).toBeTruthy();
    expect(el.querySelector('#login-password')).toBeTruthy();
  });

  it('renders sign in button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('.login-submit');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain('SIGN IN');
  });

  it('renders CSRF protection footer text', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.login-footer-text')?.textContent).toContain('CSRF protection');
  });

  it('button is disabled when fields are empty', () => {
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('.login-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
