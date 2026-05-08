import { RequestHistoryPageClient } from "@/components/dashboard/request-history-page-client";

type RequestHistoryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RequestHistoryPage({
  params,
}: RequestHistoryPageProps) {
  const { id } = await params;

  return <RequestHistoryPageClient requestId={id} />;
}
