import { SupplyRequestType, UserRole } from "@/lib/types";

const requestCreatorRoles: Record<SupplyRequestType, UserRole[]> = {
  MATERIAL: [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
  ],
  TRANSPORT: [
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
  ],
  MONEY: [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
  ],
  PRODUCTION: ["MECHANIC", "FOREMAN", "SITE_MANAGER", "WORKSHOP_MANAGER"],
  QUARRY: ["MECHANIC", "FOREMAN", "SITE_MANAGER", "WORKSHOP_MANAGER"],
  EXPRESS_MATERIAL: ["SUPPLY"],
  FUEL: [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
  ],
  BUSINESS_TRIP: ["MECHANIC", "FOREMAN", "SITE_MANAGER", "WORKSHOP_MANAGER"],
  APPEAL: ["MECHANIC", "FOREMAN", "SITE_MANAGER", "WORKSHOP_MANAGER"],
};

export function canCreateRequestType(
  role: UserRole | null | undefined,
  requestType: SupplyRequestType,
) {
  return Boolean(role && requestCreatorRoles[requestType].includes(role));
}
