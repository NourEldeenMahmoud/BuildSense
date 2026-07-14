import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { ComparePage } from './compare.page';

describe('ComparePage', () => {
  let component: ComparePage;
  let fixture: ComponentFixture<ComparePage>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    await TestBed.configureTestingModule({
      imports: [ComparePage, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ComparePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be MISSING_IDS when no params', () => {
    expect(component.state()).toBe('MISSING_IDS');
  });

  it('should be MISSING_IDS when one param is missing', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    expect(component.state()).toBe('MISSING_IDS');
  });

  it('should be MALFORMED_LEFT when left is invalid', () => {
    queryParamsSubject.next({ left: 'invalid', right: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    expect(component.state()).toBe('MALFORMED_LEFT');
  });

  it('should be MALFORMED_RIGHT when right is invalid', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b', right: '123' });
    fixture.detectChanges();
    expect(component.state()).toBe('MALFORMED_RIGHT');
  });

  it('should be DUPLICATE_IDS when left equals right (same case)', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b', right: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    expect(component.state()).toBe('DUPLICATE_IDS');
  });

  it('should be DUPLICATE_IDS when left equals right (different case)', () => {
    queryParamsSubject.next({ left: '64ABCDEF1234567890ABCDEF', right: '64abcdef1234567890abcdef' });
    fixture.detectChanges();
    expect(component.state()).toBe('DUPLICATE_IDS');
  });

  it('should be VALID when both are valid and distinct', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b', right: '5f9b3b3b3b3b3b3b3b3b3b3c' });
    fixture.detectChanges();
    expect(component.state()).toBe('VALID');
  });
});
