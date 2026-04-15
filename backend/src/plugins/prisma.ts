import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

const prisma = new PrismaClient();

export const prismaPlugin = fp(async (fastify) => {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
