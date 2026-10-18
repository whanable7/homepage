import Header from "@/components/common/Header";
import TextIndex from "@/components/texts/TextIndex";
import { publicTexts } from "@/lib/texts";
export const dynamic = "force-dynamic";
export const metadata = { title: "Texts | Jungwhan Park" };
export default async function TextsPage() {
  return (
    <main>
      <Header />
      <TextIndex texts={await publicTexts()} />
    </main>
  );
}
