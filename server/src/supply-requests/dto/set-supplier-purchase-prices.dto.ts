export class SetSupplierPurchasePriceItemDto {
  requestItemId: string;
  supplierPurchasePrice: string | number;
}

export class SetSupplierPurchasePricesDto {
  actorId: string;
  comment?: string;
  items: SetSupplierPurchasePriceItemDto[];
}
