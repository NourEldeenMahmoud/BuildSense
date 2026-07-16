import { Component, OnInit, inject } from '@angular/core';
import { AdminShellComponent } from './ui/shell/admin-shell.component';
import { AdminAuthService } from './core/services/admin-auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [AdminShellComponent],
  template: `<app-admin-shell />`,
})
export class AdminPage implements OnInit {
  private readonly auth = inject(AdminAuthService);

  ngOnInit(): void {
    // Trigger session recovery when the admin shell mounts
    this.auth.recoverSession();
  }
}
