export type UserRole =
  | "FOREMAN"
  | "SITE_MANAGER"
  | "WORKSHOP_MANAGER"
  | "DEPUTY_PRODUCTION_DIRECTOR"
  | "DEPUTY_TRANSPORT_DIRECTOR"
  | "SUPPLY_MANAGER"
  | "SUPPLY"
  | "PTO"
  | "CHIEF_ENGINEER"
  | "GARAGE_MANAGER"
  | "WAREHOUSE_MANAGER"
  | "STOREKEEPER"
  | "ACCOUNTANT"
  | "SECRETARY"
  | "MECHANIC"
  | "DIRECTOR";

export type User = {
  id: string;
  email: string;
  name: string;
  objectAccesses?: Array<{
    id: string;
    userId: string;
    objectId: string;
    role: UserRole;
    createdAt: string;
  }>;
};

export type ObjectType =
  | "CONSTRUCTION_OBJECT"
  | "INTERNAL_DEPARTMENT"
  | "WORKSHOP";

export type ObjectDirection = "TRANSPORT" | "CONSTRUCTION" | "PRODUCTION";

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
  direction: ObjectDirection;
  owner?: User;
  limits?: ObjectLimit[];
  materials?: ObjectMaterial[];
  userAccesses?: UserObjectAccess[];
};

export type SupplyRequestStatus =
  | "CREATED"
  | "PENDING_PTO"
  | "PENDING_CHIEF_ENGINEER"
  | "PENDING_DEPUTY_PRODUCTION_DIRECTOR"
  | "PENDING_DEPUTY_TRANSPORT_DIRECTOR"
  | "PENDING_SUPPLY_MANAGER"
  | "PENDING_SUPPLY_MANAGER_REVIEW"
  | "PENDING_SUPPLY"
  | "PENDING_DIRECTOR"
  | "PENDING_GARAGE_MANAGER"
  | "PENDING_WAREHOUSE_MANAGER"
  | "PENDING_STOREKEEPER"
  | "PENDING_ACCOUNTANT"
  | "PENDING_TRANSPORT_AUTHOR"
  | "PENDING_WORKSHOP_MANAGER"
  | "PENDING_PRODUCTION_AUTHOR"
  | "PENDING_REQUEST_AUTHOR"
  | "RETURNED_TO_SUPPLY"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type SupplyRequestType =
  | "MATERIAL"
  | "TRANSPORT"
  | "MONEY"
  | "PRODUCTION"
  | "QUARRY"
  | "EXPRESS_MATERIAL"
  | "FUEL"
  | "BUSINESS_TRIP"
  | "APPEAL";

export type MoneyRequestPaymentType = "CASH" | "NON_CASH";

export type SupplyRequestItemFulfillmentStatus =
  | "PENDING"
  | "COMPLETED"
  | "SKIPPED";

export type ApprovalAction =
  | "CREATED"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "SENT_TO_PTO"
  | "SENT_TO_CHIEF_ENGINEER"
  | "SENT_TO_SUPPLY_MANAGER"
  | "SENT_TO_SUPPLY"
  | "SENT_TO_GARAGE_MANAGER"
  | "SENT_TO_WAREHOUSE_MANAGER"
  | "SENT_TO_STOREKEEPER"
  | "SENT_TO_ACCOUNTANT"
  | "SENT_TO_WORKSHOP_MANAGER"
  | "SENT_TO_AUTHOR"
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
  orderQuantity: string;
  stockQuantity: string;
  ptoLimitPrice?: string | null;
  supplierPurchasePrice?: string | null;
  cashPaidAmount?: string | null;
  cashPaymentComment?: string | null;
  fulfillmentStatus: SupplyRequestItemFulfillmentStatus;
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

export type SupplyRequestAttachment = {
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
  assignedStorekeeperId?: string | null;
  assignedWorkshopManagerId?: string | null;
  assignedById?: string | null;
  assignedAt?: string | null;
  transportType?: string | null;
  transportObjectName?: string | null;
  transportDate?: string | null;
  transportTime?: string | null;
  purpose?: string | null;
  amount?: string | null;
  paymentType?: MoneyRequestPaymentType | null;
  paymentPurpose?: string | null;
  authorObjectRole?: UserRole | null;
  object?: ObjectEntity;
  author?: User;
  assignedSupplyUser?: User | null;
  assignedStorekeeper?: User | null;
  assignedWorkshopManager?: User | null;
  assignedBy?: User | null;
  invoices?: SupplyRequestInvoice[];
  attachments?: SupplyRequestAttachment[];
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
