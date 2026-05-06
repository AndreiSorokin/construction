export type UserRole =
  | "FOREMAN"
  | "SITE_MANAGER"
  | "SUPPLY_MANAGER"
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

export type ObjectLimitType = "MATERIAL" | "TRANSPORT" | "MONEY";

export type ObjectLimit = {
  id: string;
  objectId: string;
  type: ObjectLimitType;
  limitAmount: string;
  spentAmount: string;
};

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
  owner?: User;
  limits?: ObjectLimit[];
  materials?: ObjectMaterial[];
  userAccesses?: UserObjectAccess[];
};

export type SupplyRequestStatus =
  | "CREATED"
  | "PENDING_PTO"
  | "PENDING_CHIEF_ENGINEER"
  | "PENDING_SUPPLY_MANAGER"
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
  | "SENT_TO_SUPPLY_MANAGER"
  | "SENT_TO_SUPPLY"
  | "ASSIGNED_TO_SUPPLY"
  | "SENT_TO_DIRECTOR"
  | "MARKED_IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED"
  | "COMMENTED"
  | "PRICE_UPDATED"
  | "REQUEST_ITEM_UPDATED"
  | "REQUEST_ITEM_DELETED";

export type ApprovalHistoryEntry = {
  id: string;
  requestId: string;
  actorId: string;
  action: ApprovalAction;
  fromStatus?: SupplyRequestStatus | null;
  toStatus?: SupplyRequestStatus | null;
  comment?: string | null;
  changesJson?: unknown;
  createdAt: string;
  actor?: User;
};

export type SupplyRequestItem = {
  id: string;
  materialNameSnapshot: string;
  materialTypeSnapshot: string;
  measurementUnitSnapshot: string;
  estimatedPriceSnapshot: string;
  quantity: string;
  ptoLimitPrice?: string | null;
  supplierPurchasePrice?: string | null;
};

export type SupplyRequestInvoice = {
  id: string;
  requestId: string;
  uploadedById: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy?: User;
};

export type SupplyRequest = {
  id: string;
  requestNumber: string;
  type: SupplyRequestType;
  status: SupplyRequestStatus;
  objectId: string;
  authorId: string;
  createdAt: string;
  assignedSupplyUserId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | null;
  transportType?: string | null;
  purpose?: string | null;
  object?: ObjectEntity;
  author?: User;
  assignedSupplyUser?: User | null;
  assignedBy?: User | null;
  invoices?: SupplyRequestInvoice[];
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
