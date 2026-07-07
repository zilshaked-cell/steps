import { prisma } from "@/lib/prisma";

export interface ListGroupsByInstitutionOptions {
  includeInactive?: boolean;
}

export interface CreateGroupRecordInput {
  institutionId: string;
  name: string;
  description?: string | null;
  active?: boolean;
  staffIds?: string[];
}

export interface UpdateGroupRecordInput {
  groupId: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  staffIds?: string[];
}

export function getGroupById(id: string) {
  return prisma.group.findUnique({ where: { id } });
}

export async function listGroupStaffIds(groupId: string) {
  const assignments = await prisma.groupStaffAssignment.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { staffId: true },
  });

  return assignments.map((assignment) => assignment.staffId);
}

export function listGroupsByInstitution(
  institutionId: string,
  options: ListGroupsByInstitutionOptions = {},
) {
  return prisma.group.findMany({
    where: { institutionId, ...(options.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
}

export function createGroupRecord(input: CreateGroupRecordInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        description: input.description ?? null,
        active: input.active ?? true,
      },
    });

    if (input.staffIds && input.staffIds.length > 0) {
      await tx.groupStaffAssignment.createMany({
        data: input.staffIds.map((staffId) => ({ groupId: group.id, staffId })),
      });
    }

    return group;
  });
}

export function updateGroupRecord(input: UpdateGroupRecordInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.update({
      where: { id: input.groupId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.active === undefined ? {} : { active: input.active }),
      },
    });

    if (input.staffIds) {
      await tx.groupStaffAssignment.deleteMany({ where: { groupId: group.id } });
      if (input.staffIds.length > 0) {
        await tx.groupStaffAssignment.createMany({
          data: input.staffIds.map((staffId) => ({ groupId: group.id, staffId })),
        });
      }
    }

    return group;
  });
}
