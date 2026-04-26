import fp from "fastify-plugin";

import { AuditRepository } from "./audit.repository.js";
import { AuditService } from "./audit.service.js";

export const auditPlugin = fp(async (fastify) => {
  fastify.decorate("audit", new AuditService(new AuditRepository(fastify.prisma)));
});
