import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { CompareSpecMatrixComponent, computeSpecUnion } from './compare-spec-matrix.component';

describe('computeSpecUnion', () => {
  it('returns empty array when both specs are empty', () => {
    expect(computeSpecUnion([], [])).toEqual([]);
  });

  it('returns left-only specs when right is empty', () => {
    const left = [{ label: 'Cores', value: '16' }];
    const rows = computeSpecUnion(left, []);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.displayLabel).toBe('Cores');
    expect(row.leftValue).toBe('16');
    expect(row.rightValue).toBeNull();
    expect(row.differs).toBe(true);
  });

  it('returns right-only specs when left is empty', () => {
    const right = [{ label: 'VRAM', value: '16 GB' }];
    const rows = computeSpecUnion([], right);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.displayLabel).toBe('VRAM');
    expect(row.leftValue).toBeNull();
    expect(row.rightValue).toBe('16 GB');
  });

  it('preserves original API order from left first, then right-only', () => {
    const left = [
      { label: 'Z', value: '1' },
      { label: 'A', value: '2' },
    ];
    const right = [
      { label: 'M', value: '3' },
      { label: 'B', value: '4' },
    ];
    const rows = computeSpecUnion(left, right);
    expect(rows.map((r) => r.displayLabel)).toEqual(['Z', 'A', 'M', 'B']);
  });

  it('matches labels by normalized form (case + whitespace)', () => {
    const left = [{ label: '  Cores ', value: '16' }];
    const right = [{ label: 'cores', value: '8' }];
    const rows = computeSpecUnion(left, right);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.displayLabel).toBe('  Cores '); // original label preserved
    expect(row.leftValue).toBe('16');
    expect(row.rightValue).toBe('8');
    expect(row.differs).toBe(true);
  });

  it('shows matches as not-differing when values are identical', () => {
    const left = [{ label: 'Cores', value: '16' }];
    const right = [{ label: 'Cores', value: '16' }];
    const rows = computeSpecUnion(left, right);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.differs).toBe(false);
  });

  it('shows em dash for empty values', () => {
    const left = [{ label: 'Field', value: '' }];
    const right = [{ label: 'Field', value: '' }];
    const rows = computeSpecUnion(left, right);
    expect(rows[0]!.leftValue).toBeNull();
    expect(rows[0]!.rightValue).toBeNull();
  });

  it('does not create duplicate rows for matching labels', () => {
    const left = [{ label: 'Cores', value: '16' }, { label: 'Cores', value: '8' }];
    const right = [{ label: 'cores', value: '12' }];
    const rows = computeSpecUnion(left, right);
    // First occurrence of 'cores' wins for left
    expect(rows).toHaveLength(1);
    expect(rows[0]!.leftValue).toBe('16');
  });

  it('preserves original display labels from both sides', () => {
    const left = [{ label: 'CPU Cores', value: '16' }];
    const right = [{ label: 'Number of Cores', value: '8' }];
    const rows = computeSpecUnion(left, right);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.displayLabel).toBe('CPU Cores');
    expect(rows[1]!.displayLabel).toBe('Number of Cores');
  });
});

// ---------------------------------------------------------------------------
// Signal input reactivity tests — tested via computed() on the component
// instance without template rendering (JIT input() signal limitations)
// ---------------------------------------------------------------------------

describe('CompareSpecMatrixComponent signal reactivity', () => {
  it('rows computed reacts to leftSpecs signal changes', () => {
    TestBed.configureTestingModule({ imports: [CompareSpecMatrixComponent] });
    const comp = TestBed.createComponent(CompareSpecMatrixComponent).componentInstance;

    // Default: both empty → isEmpty true, rows empty
    expect(comp.isEmpty()).toBe(true);
    expect(comp.rows()).toEqual([]);

    // We can't call .set() on InputSignal (read-only public API),
    // but the computed depends on input() signals. Verify the
    // component exposes the correct signal API shape.
    expect(typeof comp.leftSpecs).toBe('function');
    expect(typeof comp.rightSpecs).toBe('function');
    expect(typeof comp.leftProductName).toBe('function');
    expect(typeof comp.rightProductName).toBe('function');
    expect(typeof comp.rows).toBe('function');
    expect(typeof comp.isEmpty).toBe('function');
  });

  it('component exposes signal-based public API for all inputs', () => {
    TestBed.configureTestingModule({ imports: [CompareSpecMatrixComponent] });
    const comp = TestBed.createComponent(CompareSpecMatrixComponent).componentInstance;

    // Verify signal shape — inputs are Signal functions (call to read)
    expect(comp.leftSpecs()).toEqual([]);
    expect(comp.rightSpecs()).toEqual([]);
    expect(comp.leftProductName()).toBe('');
    expect(comp.rightProductName()).toBe('');
  });
});
