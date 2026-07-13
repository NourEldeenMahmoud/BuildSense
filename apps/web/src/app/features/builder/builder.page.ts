import { Component } from '@angular/core';

@Component({
  selector: 'app-builder',
  standalone: true,
  template: `
    <div class="builder-page">
      <h1>PC Builder</h1>
      <p>Build your perfect PC with our compatibility engine</p>
      <div class="placeholder">
        <p>Builder features coming in M6</p>
      </div>
    </div>
  `,
  styles: `
    .builder-page {
      padding: 1rem;
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 0.5rem;
    }
    .placeholder {
      margin-top: 2rem;
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: center;
      color: #666;
    }
  `,
})
export class BuilderPage {}
