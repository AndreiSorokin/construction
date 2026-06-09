import { RequestPrintPageClient } from "@/components/dashboard/request-print-page-client";

type RequestPrintPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RequestPrintPage({ params }: RequestPrintPageProps) {
  const { id } = await params;

  return <RequestPrintPageClient requestId={id} />;
}
