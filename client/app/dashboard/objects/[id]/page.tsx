import { ObjectDetailsClient } from "@/components/dashboard/object-details-client";

type ObjectDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ObjectDetailsPage({
  params,
}: ObjectDetailsPageProps) {
  const { id } = await params;

  return <ObjectDetailsClient objectId={id} />;
}
