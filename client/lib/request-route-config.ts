import { SupplyRequestType, UserRole } from "@/lib/types";

const requestCreatorRoles: Record<SupplyRequestType, UserRole[]> = {
  MATERIAL: getMaterialAndProductionCreatorRoles(),
  TRANSPORT: getSupplyOnlyRequestCreatorRoles(),
  MONEY: getSupplyOnlyRequestCreatorRoles(),
  PRODUCTION: getMaterialAndProductionCreatorRoles(),
  QUARRY: getSupplyOnlyRequestCreatorRoles(),
  EXPRESS_MATERIAL: ["SUPPLY"],
  FUEL: getSupplyOnlyRequestCreatorRoles(),
  BUSINESS_TRIP: getSupplyOnlyRequestCreatorRoles(),
  APPEAL: getSupplyOnlyRequestCreatorRoles(),
};

function getSupplyOnlyRequestCreatorRoles(): UserRole[] {
  return [
    "MECHANIC",
    "GARAGE_MANAGER",
    "TRANSPORT_SUPPLY",
    "FOREMAN",
    "SITE_MANAGER",
    "CHIEF_ENGINEER",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
    "SUPPLY_MANAGER",
    "SUPPLY",
  ];
}

function getMaterialAndProductionCreatorRoles(): UserRole[] {
  return [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "GARAGE_MANAGER",
    "CHIEF_ENGINEER",
    "PTO",
    "WAREHOUSE_MANAGER",
    "TRANSPORT_SUPPLY",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
    "SUPPLY_MANAGER",
    "SUPPLY",
  ];
}

export function canCreateRequestType(
  role: UserRole | null | undefined,
  requestType: SupplyRequestType,
) {
  return Boolean(role && requestCreatorRoles[requestType].includes(role));
}
