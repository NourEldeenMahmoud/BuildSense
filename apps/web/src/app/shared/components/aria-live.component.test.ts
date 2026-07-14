import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AriaLiveComponent } from './aria-live.component';

@Component({
  standalone: true,
  imports: [AriaLiveComponent],
  template: `<app-aria-live [message]="msg" [politeness]="p"></app-aria-live>`
})
class TestHostComponent {
  msg = 'Loading complete';
  p: 'polite' | 'assertive' = 'polite';
}

describe('AriaLiveComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('should render message with polite aria-live', async () => {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 100));
    fixture.detectChanges();
    
    const element = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(element.textContent.trim()).toBe('Loading complete');
  });
});
