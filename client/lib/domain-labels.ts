import {
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@/lib/types";

export const requestTypeLabels: Record<SupplyRequestType, string> = {
  MATERIAL: "Материалы",
  TRANSPORT: "Транспорт",
  MONEY: "Денежные средства",
  PRODUCTION: "Производство",
};

export const requestStatusLabels: Record<SupplyRequestStatus, string> = {
  CREATED: "Создана",
  PENDING_PTO: "В ПТО",
  PENDING_CHIEF_ENGINEER: "У главного инженера",
  PENDING_DEPUTY_PRODUCTION_DIRECTOR:
    "У зам. директора по производству",
  PENDING_DEPUTY_TRANSPORT_DIRECTOR: "У зам. директора по транспорту",
  PENDING_SUPPLY_MANAGER: "У начальника снабжения",
  PENDING_SUPPLY: "У снабженца",
  PENDING_DIRECTOR: "У директора",
  PENDING_GARAGE_MANAGER: "У заведующего гаражом",
  PENDING_WAREHOUSE_MANAGER: "У начальника складского хозяйства",
  PENDING_STOREKEEPER: "У кладовщика",
  PENDING_ACCOUNTANT: "У бухгалтера",
  PENDING_TRANSPORT_AUTHOR: "У автора заявки",
  PENDING_WORKSHOP_MANAGER: "У начальника цеха",
  PENDING_PRODUCTION_AUTHOR: "У автора заявки",
  RETURNED_TO_SUPPLY: "Возвращена снабжению",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  COMPLETED: "Исполнена",
  ARCHIVED: "Архив",
};

export const userRoleLabels: Record<UserRole, string> = {
  FOREMAN: "Прораб",
  SITE_MANAGER: "Начальник участка",
  WORKSHOP_MANAGER: "Начальник цеха",
  DEPUTY_PRODUCTION_DIRECTOR: "Зам. директора по производству",
  DEPUTY_TRANSPORT_DIRECTOR: "Зам. директора по транспорту",
  SUPPLY_MANAGER: "Начальник снабжения",
  SUPPLY: "Снабженец",
  PTO: "ПТО",
  CHIEF_ENGINEER: "Главный инженер",
  GARAGE_MANAGER: "Заведующий гаражом",
  WAREHOUSE_MANAGER: "Начальник складского хозяйства",
  STOREKEEPER: "Кладовщик",
  ACCOUNTANT: "Бухгалтер",
  SECRETARY: "Секретарь",
  DIRECTOR: "Директор",
};
