import { prisma } from "@/lib/prisma";

export function listStageProgramsByInstitution(institutionId: string) {
  return prisma.stageProgram.findMany({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
}

// Returns the highest-numbered version — i.e. the currently active configuration —
// with its stages (in order), parameters, and thresholds. Historical scoring must
// keep referencing whichever version was active at the time, not this one.
export function getLatestStageProgramVersion(stageProgramId: string) {
  return prisma.stageProgramVersion.findFirst({
    where: { stageProgramId },
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
export async function getPrimaryStageProgramVersion(institutionId: string) {
  const [program] = await prisma.stageProgram.findMany({
    where: { institutionId },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  if (!program) return null;
  return getLatestStageProgramVersion(program.id);
}
