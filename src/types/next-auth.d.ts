import type { DefaultSession } from "next-auth";
import type { StaffRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: StaffRole;
      institutionId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: StaffRole;
    institutionId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: StaffRole;
    institutionId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: StaffRole;
    institutionId?: string;
  }
}
