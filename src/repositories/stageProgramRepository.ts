import { prisma } from "@/lib/prisma";

function activePublishedVersionWhere(asOf: Date) {
  return {
    status: "PUBLISHED" as const,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
    replacedById: null,
  };
}

export function listStageProgramsByInstitution(institutionId: string) {
  return prisma.stageProgram.findMany({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
}

// Returns the highest-numbered version that is published and effective now — i.e.
// the currently active configuration. Historical scoring must keep referencing
// whichever version was active at the time, not this one.
export function getLatestStageProgramVersion(stageProgramId: string, asOf = new Date()) {
  return prisma.stageProgramVersion.findFirst({
    where: { stageProgramId, ...activePublishedVersionWhere(asOf) },
    orderBy: { versionNumber: "desc" },
    include: {
      stages: { orderBy: { order: "asc" }, include: { provisions: true } },
      parameters: true,
      thresholds: true,
    },
  });
}

export function getStageProgramVersionById(id: string) {
  return prisma.stageProgramVersion.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { order: "asc" }, include: { provisions: true } },
      parameters: true,
      thresholds: true,
    },
  });
}

// Simplifying assumption: an institution has a single, primary stage program
// (the oldest one created). The schema allows more than one per institution, but
// multi-program-per-institution selection was never specified — revisit if that
// ever becomes a real requirement instead of an assumption.
export async function getPrimaryStageProgramVersion(institutionId: string, asOf = new Date()) {
  const [program] = await prisma.stageProgram.findMany({
    where: { institutionId },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  if (!program) return null;
  return getLatestStageProgramVersion(program.id, asOf);
}
