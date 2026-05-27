import { ClusterDetailPage } from "@/components/dashboard/pages/ClusterDetailPage";

type Props = { params: Promise<{ slug: string }> };

export default async function ClusterDetailRoute({ params }: Props) {
  const { slug } = await params;
  return <ClusterDetailPage slug={slug} />;
}
