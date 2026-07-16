// ---------------------------------------------------------------------------
// Admin Auth DTOs
// ---------------------------------------------------------------------------

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  ok: true;
}

export interface AdminLogoutResponse {
  ok: true;
}

export interface AdminMeResponse {
  id: string;
  email: string;
  role: 'ADMIN';
  createdAt: string;
  updatedAt: string;
}
