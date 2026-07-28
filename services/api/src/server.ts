import cors from "cors";
import express from "express";
import type { ApiError, TripBrief, TripRequest } from "@weathertrip/shared";
import { buildRecommendations } from "./recommendations.js";
import { buildPlans } from "./plans.js";
import { registerAccountRoutes } from "./accountRoutes.js";

const app = express();
const port = Number(process.env.WEATHERTRIP_API_PORT ?? process.env.PORT ?? 4100);

app.use(cors());
app.use(express.json({ limit: "256kb" }));
registerAccountRoutes(app);

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "weathertrip-api" });
});

app.post("/recommendations", async (request, response) => {
  try {
    const result = await buildRecommendations(request.body as TripRequest);
    if (isApiError(result)) {
      response.status(result.error.includes("temporarily") ? 502 : 400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: "Weathertrip could not build recommendations.",
      details: [error instanceof Error ? error.message : "Unknown server error"]
    });
  }
});

app.post("/v2/plans", async (request, response) => {
  try {
    const result = await buildPlans(request.body as TripBrief);
    if (isApiError(result)) {
      response.status(result.code === "FORECAST_UNAVAILABLE" ? 503 : 400).json(result);
      return;
    }
    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: "Weathertrip could not build that route.",
      details: [error instanceof Error ? error.message : "Unknown server error"],
      code: "PLAN_BUILD_FAILED"
    });
  }
});

app.listen(port, () => {
  console.log(`Weathertrip API listening on http://localhost:${port}`);
});

function isApiError(value: unknown): value is ApiError {
  return Boolean(value && typeof value === "object" && "error" in value);
}
