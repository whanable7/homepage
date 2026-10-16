import Header from "@/components/common/Header";
import ContactContent from "@/components/contact/ContactContent";
import { getPublicAbout as getAbout } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const contactInfo = await getAbout();

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <ContactContent contactInfo={contactInfo} />
        </div>
      </div>
    </main>
  );
}
