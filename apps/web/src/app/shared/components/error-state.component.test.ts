import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorStateComponent } from './error-state.component';

@Component({
  standalone: true,
  imports: [ErrorStateComponent],
  template: `<app-error-state [title]="t" [message]="m" [showRetry]="show" (onRetry)="retried = true"></app-error-state>`
})
class TestHostComponent {
  t = 'Connection Error';
  m = 'Could not reach server';
  show = false;
  retried = false;
}

describe('ErrorStateComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('should render alert role and text', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('[role="alert"]');
    expect(element.textContent).toContain('Connection Error');
  });

  it('should emit retry event', () => {
    fixture.componentInstance.show = true;
    fixture.detectChanges();
    const retryBtn = fixture.nativeElement.querySelector('button');
    retryBtn.click();
    expect(fixture.componentInstance.retried).toBe(true);
  });
});
