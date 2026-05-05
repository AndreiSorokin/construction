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
};

export type ObjectType = "CONSTRUCTION_OBJECT" | "INTERNAL_DEPARTMENT";

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
  userAccesses?: UserObjectAccess[];
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

export type ApprovalAction =
  | "CREATED"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "SENT_TO_PTO"
  | "SENT_TO_CHIEF_ENGINEER"
  | "SENT_TO_SUPPLY"
  | "SENT_TO_DIRECTOR"
  | "MARKED_IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED"
  | "COMMENTED"
  | "PRICE_UPDATED";

export type ApprovalHistoryEntry = {
  id: string;
  requestId: string;
  actorId: string;
  action: ApprovalAction;
  fromStatus?: SupplyRequestStatus | null;
  toStatus?: SupplyRequestStatus | null;
  comment?: string | null;
  createdAt: string;
  actor?: User;
};

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
  approvalHistory?: ApprovalHistoryEntry[];
};

export type UserObjectAccess = {
  id: string;
  userId: string;
  objectId: string;
  role: UserRole;
  createdAt: string;
  object: ObjectEntity;
  user?: User;
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
