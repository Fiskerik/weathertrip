import type { Request } from "express";

type SupabaseRow = Record<string, unknown>;

export async function authenticateRequest(request: Request): Promise<string | null> {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  const body = await response.json() as { id?: string };
  return body.id ?? null;
}

export async function supabaseRequest<T = SupabaseRow | SupabaseRow[]>(path: string, init: RequestInit = {}): Promise<T> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server credentials are not configured.");

  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
}
