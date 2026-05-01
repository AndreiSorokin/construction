export class SetPtoLimitPriceItemDto {
  requestItemId: string;
  ptoLimitPrice: string | number;
}

export class SetPtoLimitPricesDto {
  actorId: string;
  comment?: string;
  items: SetPtoLimitPriceItemDto[];
}
