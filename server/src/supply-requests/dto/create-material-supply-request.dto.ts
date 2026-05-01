export class CreateMaterialSupplyRequestItemDto {
  objectMaterialId: string;
  quantity: string | number;
}

export class CreateMaterialSupplyRequestDto {
  objectId: string;
  authorId: string;
  items: CreateMaterialSupplyRequestItemDto[];
}
