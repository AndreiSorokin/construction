import { SupplyRequestType, UserRole } from "@/lib/types";

const requestCreatorRoles: Record<SupplyRequestType, UserRole[]> = {
  MATERIAL: [
    "FOREMAN",
    "SITE_MANAGER",
    "GARAGE_MANAGER",
    "SECRETARY",
    "CHIEF_ENGINEER",
    "WORKSHOP_MANAGER",
  ],
  TRANSPORT: [
    "FOREMAN",
    "CHIEF_ENGINEER",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
    "SUPPLY",
    "DEPUTY_TRANSPORT_DIRECTOR",
  ],
  MONEY: [
    "FOREMAN",
    "SITE_MANAGER",
    "WORKSHOP_MANAGER",
    "SECRETARY",
    "CHIEF_ENGINEER",
    "DEPUTY_PRODUCTION_DIRECTOR",
    "DEPUTY_TRANSPORT_DIRECTOR",
    "SUPPLY",
    "GARAGE_MANAGER",
    "WAREHOUSE_MANAGER",
    "SUPPLY_MANAGER",
    "PTO",
  ],
};

export function canCreateRequestType(
  role: UserRole | null | undefined,
  requestType: SupplyRequestType,
) {
  return Boolean(role && requestCreatorRoles[requestType].includes(role));
}
