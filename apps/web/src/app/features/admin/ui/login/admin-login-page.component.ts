import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <!-- Left Column: Authentication Form -->
      <section class="login-form-column">
        <!-- Top Branding -->
        <div class="login-brand-bar">
          <div class="login-brand-mark">
            <div class="login-brand-bar-accent"></div>
            <span class="login-brand-name">BuildSense</span>
          </div>
        </div>

        <!-- Auth Form Wrapper -->
        <div class="login-form-wrapper">
          <div class="login-form-inner">
            <header class="login-header">
              <h1 class="login-title">ADMIN ACCESS</h1>
              <p class="login-subtitle">Sign in to manage BuildSense operations</p>
            </header>

            @if (errorMessage()) {
              <div class="login-error" role="alert">
                <span class="material-symbols-outlined login-error-icon">warning</span>
                <div class="login-error-content">
                  <span class="login-error-code">AUTH_ERROR_401</span>
                  <p class="login-error-message">{{ errorMessage() }}</p>
                </div>
              </div>
            }

            <form class="login-form" (ngSubmit)="onSubmit()" #loginForm="ngForm">
              <div class="login-fields">
                <div class="login-field">
                  <label class="login-label" for="login-email">OPERATOR_ID / EMAIL</label>
                  <div class="login-input-wrapper">
                    <input
                      id="login-email"
                      class="login-input"
                      type="email"
                      name="email"
                      [(ngModel)]="email"
                      required
                      autocomplete="email"
                      [disabled]="isSubmitting()"
                      placeholder="admin@buildsense.ops"
                    />
                  </div>
                </div>

                <div class="login-field">
                  <div class="login-label-row">
                    <label class="login-label" for="login-password">ACCESS_KEY / PASSWORD</label>
                  </div>
                  <div class="login-input-wrapper">
                    <input
                      id="login-password"
                      class="login-input"
                      type="password"
                      name="password"
                      [(ngModel)]="password"
                      required
                      autocomplete="current-password"
                      [disabled]="isSubmitting()"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <button
                class="login-submit"
                type="submit"
                [disabled]="isSubmitting() || !email || !password"
              >
                @if (isSubmitting()) {
                  <span class="login-spinner"></span>
                  AUTHENTICATING...
                } @else {
                  <span>SIGN IN</span>
                  <span class="material-symbols-outlined login-submit-icon">arrow_forward</span>
                }
              </button>
            </form>
          </div>
        </div>
      </section>

      <!-- Right Column: Visual (desktop only) -->
      <section class="login-visual-column">
        <img
          class="login-visual-image"
          src="assets/images/admin-login-hardware.png"
          alt=""
        />
      </section>
    </div>
  `,
  styles: `
    .login-shell {
      display: flex;
      min-height: 100vh;
      background: #131313;
      overflow: hidden;
    }

    /* ── Left Column: Form ───────────────────────────────────────────── */
    .login-form-column {
      width: 100%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #444932;
      background: #131313;
      position: relative;
      z-index: 10;
    }

    @media (min-width: 769px) {
      .login-form-column {
        width: 480px;
      }
    }
    @media (min-width: 1024px) {
      .login-form-column {
        width: 560px;
      }
    }

    /* ── Top Branding ────────────────────────────────────────────────── */
    .login-brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
    }

    .login-brand-mark {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .login-brand-bar-accent {
      width: 8px;
      height: 32px;
      background: #caf300;
    }

    .login-brand-name {
      font-family: var(--font-primary);
      font-size: 24px;
      font-weight: 600;
      color: #e5e2e1;
      letter-spacing: -0.02em;
    }

    /* ── Form Wrapper ────────────────────────────────────────────────── */
    .login-form-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 40px;
    }

    .login-form-inner {
      max-width: 400px;
      width: 100%;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      .login-form-wrapper {
        padding: 24px 16px;
      }
    }

    /* ── Header ──────────────────────────────────────────────────────── */
    .login-header {
      margin-bottom: 32px;
    }

    .login-title {
      font-family: var(--font-primary);
      font-size: 24px;
      font-weight: 600;
      color: #e5e2e1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      line-height: 32px;
    }

    .login-subtitle {
      font-family: var(--font-primary);
      font-size: 14px;
      color: #c5c9ac;
      margin-top: 8px;
      line-height: 20px;
    }

    /* ── Error Alert ─────────────────────────────────────────────────── */
    .login-error {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      border: 1px solid #93000a;
      background: rgba(147, 0, 10, 0.1);
      margin-bottom: 24px;
    }

    .login-error-icon {
      font-size: 24px;
      color: #ffb4ab;
      flex-shrink: 0;
      font-variation-settings: 'FILL' 1;
    }

    .login-error-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .login-error-code {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #ffb4ab;
    }

    .login-error-message {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #ffdad6;
      line-height: 16px;
      margin: 0;
    }

    /* ── Form ────────────────────────────────────────────────────────── */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .login-fields {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .login-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .login-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .login-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c5c9ac;
    }

    .login-input-wrapper {
      position: relative;
    }

    .login-input {
      width: 100%;
      background: #201f1f;
      border: 1px solid #444932;
      color: #e5e2e1;
      padding: 16px;
      font-family: var(--font-mono);
      font-size: 14px;
      line-height: 20px;
      outline: none;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }
    .login-input:focus {
      border-color: #caf300;
    }
    .login-input::placeholder {
      color: #c5c9ac;
      opacity: 0.3;
    }
    .login-input:disabled {
      opacity: 0.5;
    }

    /* ── Submit Button ───────────────────────────────────────────────── */
    .login-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px 24px;
      background: #caf300;
      color: #171e00;
      border: none;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: filter 0.15s, transform 0.1s;
    }
    .login-submit:hover:not(:disabled) {
      filter: brightness(1.1);
    }
    .login-submit:active:not(:disabled) {
      transform: scale(0.98);
    }
    .login-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .login-submit-icon {
      font-size: 18px;
    }

    .login-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(23, 30, 0, 0.2);
      border-top-color: #171e00;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Right Column: Visual ────────────────────────────────────────── */
    .login-visual-column {
      display: none;
      flex: 1;
      background: #0e0e0e;
      position: relative;
      overflow: hidden;
    }

    @media (min-width: 769px) {
      .login-visual-column {
        display: flex;
      }
    }

    .login-visual-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      transform: scaleX(-1);
    }
  `,
})
export class AdminLoginPage implements OnInit {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.status() === 'authenticated') {
        this.redirectAfterLogin();
      }
    });
  }

  ngOnInit(): void {
    // If already authenticated, redirect to admin dashboard or return URL
    if (this.auth.isAuthenticated()) {
      this.redirectAfterLogin();
      return;
    }

    // Recover session on mount
    this.auth.recoverSession();
  }

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const success = await this.auth.login(this.email, this.password);

    this.isSubmitting.set(false);

    if (success) {
      this.redirectAfterLogin();
    } else {
      this.errorMessage.set(this.auth.error() ?? 'Invalid email or password.');
    }
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] as string | undefined;
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/admin']);
    }
  }
}
