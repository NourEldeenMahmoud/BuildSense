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

  it('renders sidebar with Admin Control subtitle', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.admin-sidebar-subtitle')?.textContent).toContain('Admin Control');
  });

  it('renders navigation links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const desktopSidebar = el.querySelector('.admin-sidebar:not(.admin-sidebar--mobile)');
    const links = desktopSidebar!.querySelectorAll('.admin-sidebar-link');
    // 7 nav links + footer "Back to Catalog" link = 8 (desktop)
    expect(links.length).toBe(8);
  });

  it('renders exactly seven protected nav items', () => {
    const el: HTMLElement = fixture.nativeElement;
    const desktopNav = el.querySelector('.admin-sidebar:not(.admin-sidebar--mobile) .admin-sidebar-nav');
    const navLinks = desktopNav?.querySelectorAll('.admin-sidebar-link');
    expect(navLinks?.length).toBe(7);
  });

  it('does not include Audit Log or Admin Login in nav', () => {
    const el: HTMLElement = fixture.nativeElement;
    const desktopSidebar = el.querySelector('.admin-sidebar:not(.admin-sidebar--mobile)');
    const allLinks = desktopSidebar!.querySelectorAll('.admin-sidebar-link');
    const linkTexts = Array.from(allLinks).map((l) => l.textContent?.trim().toLowerCase() ?? '');
    expect(linkTexts).not.toContain('audit log');
    expect(linkTexts).not.toContain('admin login');
  });

  it('has correct nav labels', () => {
    const el: HTMLElement = fixture.nativeElement;
    const desktopNav = el.querySelector('.admin-sidebar:not(.admin-sidebar--mobile) .admin-sidebar-nav');
    const navLinks = desktopNav?.querySelectorAll('.admin-sidebar-link');
    // textContent includes icon glyph, so check for label substring inclusion
    const labels = Array.from(navLinks ?? []).map((l) => l.textContent?.trim() ?? '');
    expect(labels.length).toBe(7);
    expect(labels[0]).toContain('Overview');
    expect(labels[1]).toContain('Scrape Runs');
    expect(labels[2]).toContain('Match Reviews');
    expect(labels[3]).toContain('Data Quality');
    expect(labels[4]).toContain('Eligibility Overrides');
    expect(labels[5]).toContain('Worker Jobs');
    expect(labels[6]).toContain('Compatibility Quality');
  });

  it('has logout button in sidebar footer', () => {
    const el: HTMLElement = fixture.nativeElement;
    const logoutBtn = el.querySelector('.admin-sidebar-logout');
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn?.textContent).toContain('Logout');
  });

  it('does not have logout button in topbar', () => {
    const el: HTMLElement = fixture.nativeElement;
    const topbar = el.querySelector('.admin-topbar');
    const logoutInTopbar = topbar?.querySelector('.admin-logout-btn');
    expect(logoutInTopbar).toBeFalsy();
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

  it('does not render admin footer', () => {
    const el: HTMLElement = fixture.nativeElement;
    const footer = el.querySelector('.admin-footer');
    expect(footer).toBeFalsy();
  });
});
