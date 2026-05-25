import { careerTracks } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import { companySchema } from "../schemas.js";
import type { Repository } from "../repository.js";

export async function companiesRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/companies", async (request) => {
    const query = request.query as { q?: string; track?: string; tier?: string; geography?: string };
    return repository.listCompanies({
      q: query.q,
      track: careerTracks.includes(query.track as (typeof careerTracks)[number])
        ? (query.track as (typeof careerTracks)[number])
        : undefined,
      tier: query.tier ? Number(query.tier) : undefined,
      geography: query.geography
    });
  });

  app.post("/api/companies", async (request) => {
    return repository.createCompany(companySchema.parse(request.body));
  });
}
