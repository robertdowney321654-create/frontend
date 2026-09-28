export type AppRole = "participant" | "organizer" | "judge" | "admin";

export type OrganizationProfile = { name: string; website: string; description: string };
export type Account = { id: number; email: string; full_name: string; role: AppRole; roles: AppRole[] };
export type AuthSession = { access_token: string; token_type: "bearer"; account: Account; organization: OrganizationProfile | null };

export const authApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${authApiBaseUrl}/api/v1${path}`, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed with HTTP ${response.status}.`);
  }
  return await response.json() as T;
}

export function registerAccount(input: { full_name: string; email: string; password: string; role: AppRole; organization_name?: string }): Promise<AuthSession> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function loginAccount(input: { email: string; password: string; role: AppRole; organization_name?: string }): Promise<AuthSession> {
  return request("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function loadSession(token: string): Promise<AuthSession> {
  return request("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export function savePersonProfile(token: string, fullName: string): Promise<Account> {
  return request("/auth/profile", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ full_name: fullName }) });
}

export function saveOrganizationProfile(token: string, profile: OrganizationProfile): Promise<OrganizationProfile> {
  return request("/auth/organization", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...profile, website: profile.website.trim() || null }) });
}

export type OrganizationMember = { id: number; email: string; full_name: string; role: string };

export function listOrganizationMembers(token: string): Promise<OrganizationMember[]> {
  return request("/auth/organization/members", { headers: { Authorization: `Bearer ${token}` } });
}

export function inviteOrganizationMember(token: string, email: string): Promise<OrganizationMember> {
  return request("/auth/organization/members", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ email }) });
}
