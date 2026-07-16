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
      <div class="login-card">
        <div class="login-header">
          <span class="material-symbols-outlined login-brand-icon">dns</span>
          <h1 class="login-title">BuildSense</h1>
          <p class="login-subtitle">Admin Console</p>
        </div>

        <form class="login-form" (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="login-field">
            <label class="login-label" for="login-email">EMAIL</label>
            <input
              id="login-email"
              class="login-input"
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
              [disabled]="isSubmitting()"
              placeholder="admin@buildsense.dev"
            />
          </div>

          <div class="login-field">
            <label class="login-label" for="login-password">PASSWORD</label>
            <input
              id="login-password"
              class="login-input"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
              [disabled]="isSubmitting()"
              placeholder="Enter password"
            />
          </div>

          @if (errorMessage()) {
            <div class="login-error" role="alert">
              <span class="material-symbols-outlined login-error-icon">error</span>
              {{ errorMessage() }}
            </div>
          }

          <button
            class="login-submit"
            type="submit"
            [disabled]="isSubmitting() || !email || !password"
          >
            @if (isSubmitting()) {
              <span class="login-spinner"></span>
              AUTHENTICATING...
            } @else {
              <span class="material-symbols-outlined" style="font-size:16px;">key</span>
              SIGN IN
            }
          </button>
        </form>

        <div class="login-footer">
          <span class="login-footer-text">Secure session with CSRF protection</span>
        </div>
      </div>
    </div>
  `,
  styles: `
    .login-shell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #131313;
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: #1c1b1b;
      border: 1px solid #353534;
    }

    .login-header {
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #353534;
    }

    .login-brand-icon {
      font-size: 40px;
      color: #caf300;
      font-variation-settings: 'FILL' 1;
    }

    .login-title {
      font-family: var(--font-primary);
      font-size: 32px;
      font-weight: 700;
      color: #caf300;
      letter-spacing: -0.02em;
      margin-top: 12px;
    }

    .login-subtitle {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
      margin-top: 4px;
    }

    .login-form {
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .login-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .login-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #c8c6c5;
    }

    .login-input {
      background: #131313;
      border: 1px solid #353534;
      color: #e5e2e1;
      padding: 12px 16px;
      font-family: var(--font-primary);
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    .login-input:focus {
      border-color: #caf300;
    }
    .login-input::placeholder {
      color: #555;
    }
    .login-input:disabled {
      opacity: 0.5;
    }

    .login-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border: 1px solid #ff4b4b;
      background: rgba(255, 75, 75, 0.1);
      font-family: var(--font-mono);
      font-size: 12px;
      color: #ff4b4b;
    }

    .login-error-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .login-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 24px;
      background: #caf300;
      color: #000;
      border: none;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: background 0.15s;
    }
    .login-submit:hover:not(:disabled) {
      background: #b0d500;
    }
    .login-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .login-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.2);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-footer {
      padding: 16px 32px;
      border-top: 1px solid #353534;
      text-align: center;
    }

    .login-footer-text {
      font-family: var(--font-mono);
      font-size: 10px;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.08em;
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
