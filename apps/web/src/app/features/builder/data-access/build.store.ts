import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, catchError, of, tap, map, Observable } from 'rxjs';
import { BuildService } from './build.service';
import { getLatestBuildId, setLatestBuildId, clearLatestBuildId } from '../../../core/storage';
import {
  mapBuildToSlotViewModels,
  mapBuildToSummaryViewModel,
  type BuilderSlotKey,
} from '../builder-view.models';
import type {
  BuildDto,
  CandidatesApiResponse,
  PurchasePlanDto,
} from '@buildsense/contracts';
import type { BuilderSlotViewModel, BuilderSummaryViewModel } from '../builder-view.models';

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export type BuildStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'creating'
  | 'not-found'
  | 'api-error';

export interface BuildState {
  status: BuildStatus;
  build: BuildDto | null;
  errorMessage: string | null;
  /** Visible conflict notice — set on 409, cleared on next successful mutation or route change. */
  conflictMessage: string | null;
}

// ---------------------------------------------------------------------------
// Candidate state
// ---------------------------------------------------------------------------

export interface CandidateState {
  /** Which slot the selection drawer is open for. null = closed. */
  readonly selectedSlot: BuilderSlotKey | null;
  /** Candidate groups for the open slot. */
  readonly groups: CandidatesApiResponse['groups'];
  /** Pagination metadata. */
  readonly pagination: CandidatesApiResponse['pagination'] | null;
  /** Loading indicator for candidate fetch. */
  readonly loading: boolean;
  /** Error message if candidate fetch failed. */
  readonly errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

@Injectable()
export class BuildStore {
  private readonly buildService = inject(BuildService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<BuildState>({
    status: 'idle',
    build: null,
    errorMessage: null,
    conflictMessage: null,
  });

  private readonly candidateState = signal<CandidateState>({
    selectedSlot: null,
    groups: [],
    pagination: null,
    loading: false,
    errorMessage: null,
  });

  private readonly purchasePlanState = signal<{
    data: PurchasePlanDto | null;
    loading: boolean;
    errorMessage: string | null;
  }>({
    data: null,
    loading: false,
    errorMessage: null,
  });

  // ---------------------------------------------------------------------------
  // Public selectors — build
  // ---------------------------------------------------------------------------

  readonly status = computed(() => this.state().status);
  readonly build = computed(() => this.state().build);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly conflictMessage = computed(() => this.state().conflictMessage);
  readonly loading = computed(() => this.state().status === 'loading');
  readonly creating = computed(() => this.state().status === 'creating');
  readonly loaded = computed(() => this.state().status === 'loaded');
  readonly notFound = computed(() => this.state().status === 'not-found');
  readonly apiError = computed(() => this.state().status === 'api-error');

  // Derived view-models — null when no build is loaded
  readonly slots = computed<readonly BuilderSlotViewModel[] | null>(() => {
    const b = this.build();
    return b ? mapBuildToSlotViewModels(b) : null;
  });
  readonly summary = computed<BuilderSummaryViewModel | null>(() => {
    const b = this.build();
    return b ? mapBuildToSummaryViewModel(b) : null;
  });

  // Convenience computed
  readonly publicId = computed(() => this.build()?.publicId ?? null);
  readonly version = computed(() => this.build()?.version ?? 0);

  // ---------------------------------------------------------------------------
  // Public selectors — candidates
  // ---------------------------------------------------------------------------

  readonly selectedSlot = computed(() => this.candidateState().selectedSlot);
  readonly candidateGroups = computed(() => this.candidateState().groups);
  readonly candidatePagination = computed(() => this.candidateState().pagination);
  readonly candidatesLoading = computed(() => this.candidateState().loading);
  readonly candidatesError = computed(() => this.candidateState().errorMessage);
  readonly selectionDrawerOpen = computed(() => this.candidateState().selectedSlot !== null);

  // ---------------------------------------------------------------------------
  // Public selectors — purchase plan
  // ---------------------------------------------------------------------------

  readonly purchasePlan = computed(() => this.purchasePlanState().data);
  readonly purchasePlanLoading = computed(() => this.purchasePlanState().loading);
  readonly purchasePlanError = computed(() => this.purchasePlanState().errorMessage);

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private readonly retry$ = new Subject<void>();

  constructor() {
    this.setupRouteSubscription();
  }

  // ---------------------------------------------------------------------------
  // Route subscription — two behaviors in one
  // ---------------------------------------------------------------------------

  private setupRouteSubscription(): void {
    // Build a trigger observable that re-emits the latest params on retry
    const trigger$: Observable<string | null> = new Observable<string | null>((subscriber) => {
      let latestPublicId: string | null = null;

      const routeSub = this.route.paramMap
        .pipe(
          map((params) => params.get('publicId') ?? null),
        )
        .subscribe((id) => {
          latestPublicId = id;
          subscriber.next(id);
        });

      const retrySub = this.retry$.subscribe(() => {
        subscriber.next(latestPublicId);
      });

      return () => {
        routeSub.unsubscribe();
        retrySub.unsubscribe();
      };
    });

    trigger$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((publicId) => this.handleRouteTrigger(publicId)),
      )
      .subscribe();
  }

  // ---------------------------------------------------------------------------
  // Route trigger handler
  // ---------------------------------------------------------------------------

  private handleRouteTrigger(publicId: string | null | undefined): Observable<unknown> {
    // Close selection drawer and clear conflict on route change
    this.closeSelectionDrawer();
    this.clearConflictNotice();

    // /builder/:publicId → load the build
    if (publicId != null && publicId.length > 0) {
      return this.loadBuild(publicId, { saveRecoveryId: true });
    }

    // /builder (no param) → recovery / create
    return this.recoverOrCreate();
  }

  // ---------------------------------------------------------------------------
  // Load a build by public ID
  // ---------------------------------------------------------------------------

  private loadBuild(
    publicId: string,
    options: { saveRecoveryId: boolean } = { saveRecoveryId: false },
  ): Observable<BuildDto | null> {
    this.state.update((s) => ({
      ...s,
      status: 'loading',
      build: null,
      errorMessage: null,
    }));

    return this.buildService.getBuild(publicId).pipe(
      tap((build) => {
        this.state.update((s) => ({
          ...s,
          status: 'loaded',
          build,
          errorMessage: null,
        }));
        if (options.saveRecoveryId) {
          setLatestBuildId(build.publicId);
        }
      }),
      catchError((err) => {
        const status = err?.status === 404 ? 'not-found' : 'api-error';
        const message =
          err?.status === 404
            ? 'Build not found.'
            : err?.error?.error ||
              err?.message ||
              'Failed to load build.';

        this.state.update((s) => ({
          ...s,
          status,
          build: null,
          errorMessage: message,
        }));

        // If the saved ID is not found, clear it to prevent infinite loops
        if (err?.status === 404) {
          clearLatestBuildId();
        }

        return of(null);
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Recovery / creation logic for /builder (no param)
  // ---------------------------------------------------------------------------

  private recoverOrCreate(): Observable<unknown> {
    const savedId = getLatestBuildId();

    if (savedId !== null && savedId.length > 0) {
      // Try to load the saved build. On 404 → create new.
      return this.buildService.getBuild(savedId).pipe(
        tap((build) => {
          // Navigate to canonical route (replaceUrl to avoid back-button loop)
          void this.router.navigate(['/builder', build.publicId], {
            replaceUrl: true,
          });
          this.state.update((s) => ({
            ...s,
            status: 'loaded',
            build,
            errorMessage: null,
          }));
          setLatestBuildId(build.publicId);
        }),
        catchError((err) => {
          if (err?.status === 404) {
            clearLatestBuildId();
            return this.createNewBuild();
          }
          // Other errors: create new build as fallback
          return this.createNewBuild();
        }),
      );
    }

    // No saved ID → create new build
    return this.createNewBuild();
  }

  // ---------------------------------------------------------------------------
  // Create a new build
  // ---------------------------------------------------------------------------

  private createNewBuild(): Observable<BuildDto | null> {
    this.state.update((s) => ({
      ...s,
      status: 'creating',
      build: null,
      errorMessage: null,
    }));

    return this.buildService.createBuild().pipe(
      tap((build) => {
        setLatestBuildId(build.publicId);
        // Navigate to canonical route (replaceUrl)
        void this.router.navigate(['/builder', build.publicId], {
          replaceUrl: true,
        });
        this.state.update((s) => ({
          ...s,
          status: 'loaded',
          build,
          errorMessage: null,
        }));
      }),
      catchError((err) => {
        const message =
          err?.error?.error ||
          err?.message ||
          'Failed to create build.';
        this.state.update((s) => ({
          ...s,
          status: 'api-error',
          build: null,
          errorMessage: message,
        }));
        return of(null);
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Public actions — build
  // ---------------------------------------------------------------------------

  /** Retry the last failed load/create. */
  retry(): void {
    this.retry$.next();
  }

  /**
   * Handle a version conflict by replacing state with the canonical latestBuild
   * and showing a visible conflict notice. No auto-replay — the user sees the
   * notice and can retry manually.
   */
  handleConflict(latestBuild: BuildDto | null): boolean {
    if (!latestBuild) {
      return false;
    }
    this.state.update((s) => ({
      ...s,
      status: 'loaded',
      build: latestBuild,
      errorMessage: null,
      conflictMessage:
        'The build was modified by another request. ' +
        'The latest version has been loaded — your pending change was not applied.',
    }));
    setLatestBuildId(latestBuild.publicId);
    // Close selection drawer after conflict replacement
    this.closeSelectionDrawer();
    return true;
  }

  /** Clear the conflict notice. */
  clearConflictNotice(): void {
    this.state.update((s) => ({ ...s, conflictMessage: null }));
  }

  /**
   * Reload the current build from the API.
   * No-op if no build is loaded.
   */
  reload(): void {
    const id = this.publicId();
    if (id) {
      void this.loadBuild(id, { saveRecoveryId: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Public actions — candidates
  // ---------------------------------------------------------------------------

  /** Open the selection drawer for a slot. Triggers candidate fetch. */
  selectSlot(slotKey: BuilderSlotKey): void {
    const id = this.publicId();
    if (!id) return;

    this.candidateState.update((s) => ({
      ...s,
      selectedSlot: slotKey,
      groups: [],
      pagination: null,
      loading: true,
      errorMessage: null,
    }));

    this.buildService.getCandidates(id, slotKey).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap((response) => {
        this.candidateState.update((s) => ({
          ...s,
          groups: response.groups,
          pagination: response.pagination,
          loading: false,
          errorMessage: null,
        }));
      }),
      catchError((err) => {
        const message =
          err?.error?.error ||
          err?.message ||
          'Failed to load candidates.';
        this.candidateState.update((s) => ({
          ...s,
          loading: false,
          errorMessage: message,
        }));
        return of(null);
      }),
    ).subscribe();
  }

  /** Close the selection drawer. */
  closeSelectionDrawer(): void {
    this.candidateState.update((s) => ({
      ...s,
      selectedSlot: null,
      groups: [],
      pagination: null,
      loading: false,
      errorMessage: null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Public actions — mutations
  // ---------------------------------------------------------------------------

  /**
   * Add or replace a product in a slot (PUT = idempotent).
   * On success: replaces local build state with the returned BuildDto.
   * On 409: delegates to handleConflict.
   * On other error: sets mutationError on the candidate state.
   */
  putItem(slot: BuilderSlotKey, productId: string, quantity: number): void {
    const id = this.publicId();
    const ver = this.version();
    if (!id || ver === 0) return;

    this.buildService.putItem(id, slot, {
      productId,
      quantity,
      expectedVersion: ver,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap((build) => {
        this.state.update((s) => ({
          ...s,
          status: 'loaded',
          build,
          errorMessage: null,
          conflictMessage: null,
        }));
        setLatestBuildId(build.publicId);
        this.closeSelectionDrawer();
      }),
      catchError((err) => {
        // 409 conflict — extract latestBuild from response details
        if (err?.status === 409) {
          const details = err?.error?.details as
            | { latestBuild?: BuildDto }
            | undefined;
          this.handleConflict(details?.latestBuild ?? null);
          return of(null);
        }

        const message =
          err?.error?.error ||
          err?.message ||
          'Failed to update slot.';
        this.candidateState.update((s) => ({
          ...s,
          errorMessage: message,
        }));
        return of(null);
      }),
    ).subscribe();
  }

  /**
   * Remove a product from a slot (DELETE).
   * On success: replaces local build state with the returned BuildDto.
   * On 409: delegates to handleConflict.
   */
  deleteItem(slot: BuilderSlotKey): void {
    const id = this.publicId();
    const ver = this.version();
    if (!id || ver === 0) return;

    this.buildService.deleteItem(id, slot, {
      expectedVersion: ver,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap((build) => {
        this.state.update((s) => ({
          ...s,
          status: 'loaded',
          build,
          errorMessage: null,
          conflictMessage: null,
        }));
        setLatestBuildId(build.publicId);
      }),
      catchError((err) => {
        if (err?.status === 409) {
          const details = err?.error?.details as
            | { latestBuild?: BuildDto }
            | undefined;
          this.handleConflict(details?.latestBuild ?? null);
          return of(null);
        }

        const message =
          err?.error?.error ||
          err?.message ||
          'Failed to clear slot.';
        this.state.update((s) => ({
          ...s,
          status: 'api-error',
          errorMessage: message,
        }));
        return of(null);
      }),
    ).subscribe();
  }

  // ---------------------------------------------------------------------------
  // Public actions — purchase plan
  // ---------------------------------------------------------------------------

  /** Fetch the purchase plan for the current build. */
  loadPurchasePlan(): void {
    const id = this.publicId();
    if (!id) return;

    this.purchasePlanState.update((s) => ({
      ...s,
      loading: true,
      errorMessage: null,
    }));

    this.buildService.getPurchasePlan(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap((plan) => {
        this.purchasePlanState.update(() => ({
          data: plan,
          loading: false,
          errorMessage: null,
        }));
      }),
      catchError((err) => {
        const message =
          err?.error?.error ||
          err?.message ||
          'Failed to load purchase plan.';
        this.purchasePlanState.update((s) => ({
          ...s,
          loading: false,
          errorMessage: message,
        }));
        return of(null);
      }),
    ).subscribe();
  }
}
