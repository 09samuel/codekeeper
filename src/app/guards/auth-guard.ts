import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const accessToken = authService.getAccessToken();

  // No token → redirect
  if (!accessToken) {
    router.navigate(['']);
    return false;
  }

  // Token still valid → allow
  if (!authService.isTokenExpired(accessToken)) {
    return true;
  }

  // Try refresh
  const refreshed = await authService.refreshTokens();
  if (refreshed) {
    return true;
  }

  // Redirect if refresh failed
  router.navigate(['']);
  return false;
};
