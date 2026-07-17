import { describe, expect, it, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminShellComponent } from './admin-shell.component';

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
  });

  it('renders sidebar with BuildSense title', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.admin-sidebar-title')?.textContent).toContain('BuildSense');
  });

  it('renders sidebar with Admin subtitle', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.admin-sidebar-subtitle')?.textContent).toContain('Admin');
  });

  it('renders navigation links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll('.admin-sidebar-link');
    // 8 nav links + footer "Back to Catalog" link = 9 (desktop)
    expect(links.length).toBeGreaterThanOrEqual(9);
  });

  it('has logout button in topbar', () => {
    const el: HTMLElement = fixture.nativeElement;
    const logoutBtn = el.querySelector('.admin-logout-btn');
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn?.textContent).toContain('LOGOUT');
  });

  it('has mobile menu button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const menuBtn = el.querySelector('.admin-mobile-menu-btn');
    expect(menuBtn).toBeTruthy();
  });

  it('has a router-outlet', () => {
    const el: HTMLElement = fixture.nativeElement;
    const outlet = el.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });
});
