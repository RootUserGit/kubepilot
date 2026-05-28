import { ClusterDetailPage } from "@/components/dashboard/pages/ClusterDetailPage";

type Props = { params: Promise<{ slug: string }> };

/** Route segment is cluster UUID (`/dashboard/clusters/{id}`). */
export default async function ClusterDetailRoute({ params }: Props) {
  const { slug: clusterId } = await params;
  return <ClusterDetailPage clusterId={clusterId} />;
}
