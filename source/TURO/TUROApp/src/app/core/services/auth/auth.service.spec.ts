import { TestBed } from '@angular/core/testing';
import { AuthService, roleOf } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

/** Un JWT lisible par le front (la signature n'est jamais vérifiée côté navigateur) */
function jwt(payload: object): string {
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${body}.signature`;
}

describe('roleOf', () => {
  it('should read the role claim of the token', () => {
    expect(roleOf(jwt({ role: 'Admin' }))).toBe('Admin');
    expect(roleOf(jwt({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Staff' }))).toBe('Staff');
  });

  it('should return null without token, without role, or for an unreadable token', () => {
    expect(roleOf(null)).toBeNull();
    expect(roleOf(jwt({ sub: 'x' }))).toBeNull();
    expect(roleOf(jwt({ role: 'Patron' }))).toBeNull();
    expect(roleOf('pas.un.jwt')).toBeNull();
  });
});
