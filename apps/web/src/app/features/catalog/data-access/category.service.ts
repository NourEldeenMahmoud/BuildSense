import { Injectable, inject, signal, computed } from '@angular/core';
import { CatalogService } from './catalog.service';
import { tap, catchError, of } from 'rxjs';

interface CategoryState {
  items: string[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly catalogService = inject(CatalogService);

  private readonly state = signal<CategoryState>({
    items: [],
    loading: false,
    error: null,
    loaded: false
  });

  readonly categories = computed(() => this.state().items);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);

  load(): void {
    if (this.state().loaded || this.state().loading) return;

    this.state.update(s => ({ ...s, loading: true, error: null }));

    this.catalogService.getCategories().pipe(
      tap(res => {
        this.state.update(() => ({
          items: res.items,
          loading: false,
          error: null,
          loaded: true
        }));
      }),
      catchError(err => {
        this.state.update(s => ({
          ...s,
          loading: false,
          error: err?.message || 'Failed to load categories'
        }));
        return of(null);
      })
    ).subscribe();
  }
}
