import { PrismaClient } from "@/app/generated/prisma";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

globalThis.prismaGlobal = prisma;
