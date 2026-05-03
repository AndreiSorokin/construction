export type UserRole =
  | "FOREMAN"
  | "SITE_MANAGER"
  | "SUPPLY"
  | "PTO"
  | "CHIEF_ENGINEER"
  | "DIRECTOR";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
};

export type ObjectType = "CONSTRUCTION_OBJECT" | "INTERNAL_DEPARTMENT";

export type UserObjectRole = "OWNER" | "RESPONSIBLE" | "VIEWER";

export type ObjectMaterial = {
  id: string;
  name: string;
  type: string;
  measurementUnit: string;
  estimatedPrice: string;
};

export type ObjectEntity = {
  id: string;
  name: string;
  type: ObjectType;
  closingLimit: string;
  owner?: User;
  materials?: ObjectMaterial[];
};

export type SupplyRequestStatus =
  | "CREATED"
  | "PENDING_PTO"
  | "PENDING_CHIEF_ENGINEER"
  | "PENDING_SUPPLY"
  | "PENDING_DIRECTOR"
  | "RETURNED_TO_SUPPLY"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type SupplyRequestType = "MATERIAL" | "TRANSPORT" | "MONEY";

export type SupplyRequestItem = {
  id: string;
  objectMaterialId: string;
  materialNameSnapshot: string;
  materialTypeSnapshot: string;
  measurementUnitSnapshot: string;
  estimatedPriceSnapshot: string;
  quantity: string;
  ptoLimitPrice?: string | null;
  supplierPurchasePrice?: string | null;
};

export type SupplyRequest = {
  id: string;
  requestNumber: string;
  type: SupplyRequestType;
  status: SupplyRequestStatus;
  objectId: string;
  authorId: string;
  createdAt: string;
  transportType?: string | null;
  purpose?: string | null;
  object?: ObjectEntity;
  author?: User;
  items: SupplyRequestItem[];
};

export type UserObjectAccess = {
  id: string;
  userId: string;
  objectId: string;
  role: UserObjectRole;
  createdAt: string;
  object: ObjectEntity;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type ApiErrorBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};
