import { MetadataRoute } from "next";
import { getCategories } from "@/lib/data";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://jungwhanpark.com";
  const categories = await getCategories();

  const categoryUrls = categories.map(
    (category: { slug: string; updated_at?: string }) => ({
      url: `${baseUrl}/works/${encodeURIComponent(category.slug)}`,
      lastModified: new Date(category.updated_at || new Date()),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }),
  );

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/works`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/cv`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    { url: `${baseUrl}/texts`, changeFrequency: "weekly", priority: 0.7 },
    ...categoryUrls,
  ];
}
