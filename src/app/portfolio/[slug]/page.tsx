import { redirect } from "next/navigation";
export default async function LegacyCategory({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/works/${encodeURIComponent(slug)}`);
}
