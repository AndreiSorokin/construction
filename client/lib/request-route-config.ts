import { SupplyRequestType, UserRole } from "@/lib/types";

const requestCreatorRoles: Record<SupplyRequestType, UserRole[]> = {
  MATERIAL: [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "GARAGE_MANAGER",
    "DEPUTY_TRANSPORT_DIRECTOR",
    "CHIEF_ENGINEER",
    "PTO",
    "WAREHOUSE_MANAGER",
    "SUPPLY_MANAGER",
    "SUPPLY",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
  ],
  TRANSPORT: getTransportRequestCreatorRoles(),
  MONEY: getSupplyOnlyRequestCreatorRoles(),
  PRODUCTION: [
    "MECHANIC",
    "FOREMAN",
    "SITE_MANAGER",
    "GARAGE_MANAGER",
    "DEPUTY_TRANSPORT_DIRECTOR",
    "CHIEF_ENGINEER",
    "PTO",
    "WAREHOUSE_MANAGER",
    "SUPPLY_MANAGER",
    "SUPPLY",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
  ],
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
    "DEPUTY_TRANSPORT_DIRECTOR",
    "FOREMAN",
    "SITE_MANAGER",
    "CHIEF_ENGINEER",
    "WORKSHOP_MANAGER",
    "DEPUTY_PRODUCTION_DIRECTOR",
    "SUPPLY_MANAGER",
    "SUPPLY",
  ];
}

function getTransportRequestCreatorRoles(): UserRole[] {
  return [
    "FOREMAN",
    "SITE_MANAGER",
    "CHIEF_ENGINEER",
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
