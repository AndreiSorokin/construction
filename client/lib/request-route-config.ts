import { ObjectDirection, SupplyRequestType, UserRole } from "@/lib/types";

<<<<<<< HEAD
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
=======
type DirectionCreatorRolesConfig = Partial<
  Record<SupplyRequestType, Partial<Record<ObjectDirection, UserRole[]>>>
>;

const transportSupplyCreatorRoles: UserRole[] = [
  "MECHANIC",
  "GARAGE_MANAGER",
  "DEPUTY_TRANSPORT_DIRECTOR",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const constructionSupplyCreatorRoles: UserRole[] = [
  "FOREMAN",
  "SITE_MANAGER",
  "CHIEF_ENGINEER",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const productionSupplyCreatorRoles: UserRole[] = [
  "WORKSHOP_MANAGER",
  "DEPUTY_PRODUCTION_DIRECTOR",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const transportWarehouseCreatorRoles: UserRole[] = [
  "MECHANIC",
  "GARAGE_MANAGER",
  "DEPUTY_TRANSPORT_DIRECTOR",
  "WAREHOUSE_MANAGER",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const constructionWarehousePtoCreatorRoles: UserRole[] = [
  "FOREMAN",
  "SITE_MANAGER",
  "CHIEF_ENGINEER",
  "WAREHOUSE_MANAGER",
  "PTO",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const productionWarehouseCreatorRoles: UserRole[] = [
  "WORKSHOP_MANAGER",
  "DEPUTY_PRODUCTION_DIRECTOR",
  "WAREHOUSE_MANAGER",
  "SUPPLY_MANAGER",
  "SUPPLY",
];

const requestCreatorRoles: DirectionCreatorRolesConfig = {
  MATERIAL: {
    TRANSPORT: transportWarehouseCreatorRoles,
    CONSTRUCTION: constructionWarehousePtoCreatorRoles,
    PRODUCTION: productionWarehouseCreatorRoles,
  },
  MONEY: {
    TRANSPORT: transportSupplyCreatorRoles,
    CONSTRUCTION: constructionSupplyCreatorRoles,
    PRODUCTION: productionSupplyCreatorRoles,
  },
  FUEL: {
    TRANSPORT: transportSupplyCreatorRoles,
    CONSTRUCTION: constructionSupplyCreatorRoles,
    PRODUCTION: productionSupplyCreatorRoles,
  },
  BUSINESS_TRIP: {
    TRANSPORT: transportSupplyCreatorRoles,
    CONSTRUCTION: constructionSupplyCreatorRoles,
    PRODUCTION: productionSupplyCreatorRoles,
  },
  QUARRY: {
    CONSTRUCTION: constructionSupplyCreatorRoles,
    PRODUCTION: productionSupplyCreatorRoles,
  },
  PRODUCTION: {
    TRANSPORT: transportWarehouseCreatorRoles,
    CONSTRUCTION: constructionWarehousePtoCreatorRoles,
    PRODUCTION: productionWarehouseCreatorRoles,
  },
  APPEAL: {
    TRANSPORT: transportSupplyCreatorRoles,
    CONSTRUCTION: constructionSupplyCreatorRoles,
    PRODUCTION: productionSupplyCreatorRoles,
  },
};

const directionAgnosticCreatorRoles: Partial<
  Record<SupplyRequestType, UserRole[]>
> = {
  EXPRESS_MATERIAL: ["SUPPLY"],
>>>>>>> origin/master
};

export function canCreateRequestType(
  role: UserRole | null | undefined,
  requestType: SupplyRequestType,
  objectDirection: ObjectDirection | null | undefined,
) {
  if (!role) {
    return false;
  }

  const directionAgnosticRoles = directionAgnosticCreatorRoles[requestType];

  if (directionAgnosticRoles) {
    return directionAgnosticRoles.includes(role);
  }

  if (!objectDirection) {
    return false;
  }

  return Boolean(
    requestCreatorRoles[requestType]?.[objectDirection]?.includes(role),
  );
}
