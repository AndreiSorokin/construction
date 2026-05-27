import { SupplyRequest } from "@/lib/types";

type MaterialItemsStatusListProps = {
  request: SupplyRequest;
};

export function MaterialItemsStatusList({
  request,
}: MaterialItemsStatusListProps) {
  if (request.type !== "MATERIAL" || !request.items.length) {
    return null;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[560px] border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2 font-medium">ТМЦ</th>
            <th className="px-3 py-2 font-medium">Количество</th>
            <th className="px-3 py-2 font-medium">Статус позиции</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr className="border-b border-slate-100 last:border-b-0" key={item.id}>
              <td className="px-3 py-2 font-medium text-slate-950">
                {item.materialNameSnapshot}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {formatQuantity(item.quantity)} {item.measurementUnitSnapshot}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                    item.fulfillmentStatus,
                  )}`}
                >
                  {getStatusLabel(item.fulfillmentStatus)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getStatusLabel(
  status: SupplyRequest["items"][number]["fulfillmentStatus"],
) {
  if (status === "COMPLETED") {
    return "Заказано";
  }

  if (status === "SKIPPED") {
    return "Не заказано";
  }

  return "Ожидает";
}

function getStatusClass(
  status: SupplyRequest["items"][number]["fulfillmentStatus"],
) {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "SKIPPED") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function formatQuantity(value: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return value;
  }

  return numberValue.toLocaleString("ru-KZ", {
    maximumFractionDigits: 3,
  });
}
