import { notFound } from "next/navigation";
import Header from "@/components/common/Header";
import TextReader from "@/components/texts/TextReader";
import { publicTexts } from "@/lib/texts";
export const dynamic = "force-dynamic";
export default async function TextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    text = (await publicTexts()).find((t) => t.id === id);
  if (!text) notFound();
  return (
    <main>
      <Header />
      <TextReader text={text} />
    </main>
  );
}
