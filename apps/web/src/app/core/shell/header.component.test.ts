import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderComponent } from './header.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '../api.config';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('should render mobile navigation trigger', () => {
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.mobile-only app-icon-button button');
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-label')).toBe('Open mobile navigation');
  });

  it('should open mobile navigation on trigger click', () => {
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.mobile-only app-icon-button button');
    trigger.click();
    fixture.detectChanges();
    
    expect(component.isMobileNavOpen).toBe(true);
  });
});
