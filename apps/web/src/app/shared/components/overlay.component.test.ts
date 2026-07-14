import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi as vitest } from 'vitest';
import { OverlayComponent } from './overlay.component';

@Component({
  standalone: true,
  imports: [OverlayComponent],
  template: `
    <button id="trigger-btn" (click)="open = true">Open</button>
    <app-overlay [isOpen]="open" [ariaLabel]="lbl" [title]="t" (isOpenChange)="open = $event">
      <button id="inside-btn">Inside</button>
      <a href="#" id="inside-link">Link</a>
    </app-overlay>
  `
})
class TestHostComponent {
  open = false;
  lbl = 'Test Dialog';
  t = 'Test Overlay Title';
}

describe('OverlayComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    document.body.removeChild(fixture.nativeElement);
  });

  it('should render accessible dialog name', () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(element.getAttribute('aria-label')).toBe('Test Dialog');
    expect(element.getAttribute('aria-modal')).toBe('true');
  });

  it('should trap focus inside the overlay (Tab)', async () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 10)); // Wait for focus timeout
    fixture.detectChanges();

    const closeBtn = document.getElementById('overlay-close-btn') as HTMLElement;
    const insideLink = document.getElementById('inside-link') as HTMLElement;

    const focusSpy = vitest.spyOn(closeBtn, 'focus');

    // Manually set activeElement for JSDOM
    Object.defineProperty(document, 'activeElement', {
      value: insideLink,
      writable: true
    });

    const overlayDebugElement = fixture.debugElement.query(By.directive(OverlayComponent));
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    overlayDebugElement.componentInstance.onTabKey(tabEvent);
    
    expect(focusSpy).toHaveBeenCalled();
  });

  it('should trap focus inside the overlay (Shift+Tab)', async () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 10));
    fixture.detectChanges();

    const closeBtn = document.getElementById('overlay-close-btn') as HTMLElement;
    const insideLink = document.getElementById('inside-link') as HTMLElement;

    const focusSpy = vitest.spyOn(insideLink, 'focus');

    // Manually set activeElement for JSDOM
    Object.defineProperty(document, 'activeElement', {
      value: closeBtn,
      writable: true
    });

    const overlayDebugElement = fixture.debugElement.query(By.directive(OverlayComponent));
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    overlayDebugElement.componentInstance.onTabKey(shiftTabEvent);
    
    expect(focusSpy).toHaveBeenCalled();
  });

  it('should restore body scrolling and focus when closed', async () => {
    const triggerBtn = document.getElementById('trigger-btn') as HTMLElement;
    
    // Manually set activeElement for JSDOM
    Object.defineProperty(document, 'activeElement', {
      value: triggerBtn,
      writable: true
    });
    expect(document.activeElement).toBe(triggerBtn);

    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 10));
    
    expect(document.body.style.overflow).toBe('hidden');
    
    // Close overlay
    fixture.componentInstance.open = false;
    fixture.detectChanges();
    
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(triggerBtn);
  });

  it('should handle escape key', async () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 10));

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    fixture.detectChanges();
    
    expect(fixture.componentInstance.open).toBe(false);
  });

  it('should close on backdrop click following policy', async () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 10));

    const backdrop = fixture.nativeElement.querySelector('.overlay-backdrop');
    backdrop.click();
    fixture.detectChanges();
    
    expect(fixture.componentInstance.open).toBe(false);
  });
});
