import { SupplyRequestType, UserRole } from "@/lib/types";

const requestCreatorRoles: Record<SupplyRequestType, UserRole[]> = {
  MATERIAL: [
    "FOREMAN",
    "SITE_MANAGER",
    "GARAGE_MANAGER",
    "SECRETARY",
    "CHIEF_ENGINEER",
    "WAREHOUSE_MANAGER",
    "PTO",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
  ],
  TRANSPORT: [
    "FOREMAN",
    "CHIEF_ENGINEER",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
    "SUPPLY",
  ],
  MONEY: [
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
    "SECRETARY",
    "CHIEF_ENGINEER",
    "DEPUTY_PRODUCTION_DIRECTOR",
  ],
};

export function canCreateRequestType(
  role: UserRole | null | undefined,
  requestType: SupplyRequestType,
) {
  return Boolean(role && requestCreatorRoles[requestType].includes(role));
}
