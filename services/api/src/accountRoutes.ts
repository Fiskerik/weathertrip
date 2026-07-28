import type { Express, Request, Response } from "express";
import type { SavedTrip, TripBrief, TripPlan, UserProfile } from "@weathertrip/shared";
import { authenticateRequest, supabaseConfigured, supabaseRequest } from "./supabase.js";

export function registerAccountRoutes(app: Express): void {
  app.get("/v1/profile", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      const rows = await supabaseRequest<Array<Record<string, unknown>>>(`profiles?select=*&id=eq.${encodeURIComponent(userId)}`);
      response.json(toProfile(rows[0], userId));
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.patch("/v1/profile", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      const body = request.body as Partial<UserProfile>;
      const rows = await supabaseRequest<Array<Record<string, unknown>>>("profiles", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          id: userId,
          display_name: body.displayName,
          home_location: body.homeLocation,
          units: body.units ?? "metric",
          default_adults: body.defaultAdults ?? 2,
          default_children: body.defaultChildren ?? 0,
          default_has_ev: body.defaultHasEv ?? false,
          default_max_drive_hours: body.defaultMaxDriveHours ?? 6,
          updated_at: new Date().toISOString()
        })
      });
      response.json(toProfile(rows[0], userId));
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.delete("/v1/profile", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      await supabaseRequest(`saved_trips?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
      await supabaseRequest(`profiles?id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
      response.json({ ok: true });
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.get("/v1/saved-trips", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      const rows = await supabaseRequest<Array<Record<string, unknown>>>(`saved_trips?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`);
      response.json(rows.map((row) => toSavedTrip(row)));
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.post("/v1/saved-trips", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      const body = request.body as { title?: string; brief?: TripBrief; plan?: TripPlan };
      if (!body.brief || !body.plan) {
        response.status(400).json({ error: "A saved trip needs its brief and itinerary.", code: "INVALID_SAVED_TRIP" });
        return;
      }
      const now = new Date().toISOString();
      const rows = await supabaseRequest<Array<Record<string, unknown>>>("saved_trips", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          title: body.title?.trim() || body.plan.title,
          brief_json: body.brief,
          plan_json: body.plan,
          created_at: now,
          updated_at: now
        })
      });
      response.status(201).json(toSavedTrip(rows[0]));
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.patch("/v1/saved-trips/:id", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      const body = request.body as { title?: string; plan?: TripPlan };
      const rows = await supabaseRequest<Array<Record<string, unknown>>>(
        `saved_trips?id=eq.${encodeURIComponent(request.params.id)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            ...(body.title ? { title: body.title.trim() } : {}),
            ...(body.plan ? { plan_json: body.plan } : {}),
            updated_at: new Date().toISOString()
          })
        }
      );
      response.json(toSavedTrip(rows[0]));
    } catch (error) {
      sendAccountError(response, error);
    }
  });

  app.delete("/v1/saved-trips/:id", async (request, response) => {
    const userId = await requireUser(request, response);
    if (!userId) return;
    try {
      await supabaseRequest(`saved_trips?id=eq.${encodeURIComponent(request.params.id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
      response.json({ ok: true });
    } catch (error) {
      sendAccountError(response, error);
    }
  });
}

async function requireUser(request: Request, response: Response): Promise<string | null> {
  if (!supabaseConfigured()) {
    response.status(503).json({ error: "Accounts are not configured on this API yet.", code: "AUTH_NOT_CONFIGURED" });
    return null;
  }
  const userId = await authenticateRequest(request);
  if (!userId) {
    response.status(401).json({ error: "Sign in to use your profile and saved trips.", code: "AUTH_REQUIRED" });
    return null;
  }
  return userId;
}

function toProfile(row: Record<string, unknown> | undefined, userId: string): UserProfile {
  const now = new Date().toISOString();
  return {
    id: userId,
    ...(typeof row?.email === "string" ? { email: row.email } : {}),
    ...(typeof row?.display_name === "string" ? { displayName: row.display_name } : {}),
    ...(row?.home_location ? { homeLocation: row.home_location as NonNullable<UserProfile["homeLocation"]> } : {}),
    units: row?.units === "imperial" ? "imperial" : "metric",
    defaultAdults: numberValue(row?.default_adults, 2),
    defaultChildren: numberValue(row?.default_children, 0),
    defaultHasEv: Boolean(row?.default_has_ev),
    defaultMaxDriveHours: numberValue(row?.default_max_drive_hours, 6),
    createdAt: typeof row?.created_at === "string" ? row.created_at : now,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : now
  };
}

function toSavedTrip(row: Record<string, unknown> | undefined): SavedTrip {
  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? "Saved trip"),
    brief: row?.brief_json as TripBrief,
    plan: row?.plan_json as TripPlan,
    createdAt: String(row?.created_at ?? new Date().toISOString()),
    updatedAt: String(row?.updated_at ?? new Date().toISOString()),
    source: "cloud"
  };
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sendAccountError(response: Response, error: unknown): void {
  response.status(502).json({
    error: "Could not reach the account service.",
    details: [error instanceof Error ? error.message : "Unknown account service error"],
    code: "ACCOUNT_SERVICE_UNAVAILABLE"
  });
}
