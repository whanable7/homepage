import "server-only";
import { GoogleAuth } from "google-auth-library";
import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import { koreanDate, reportBuckets, reportRanges } from "./analytics-report";
import type {
  StatisticsPeriod,
  StatisticsReport,
  StatisticsTotals,
} from "./analytics-report";
interface GARow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}
interface GAReport {
  rows?: GARow[];
  rowCount?: number;
  metadata?: {
    timeZone?: string;
    subjectToThresholding?: boolean;
    dataLossFromOtherRow?: boolean;
  };
}
const totals = (row?: GARow): StatisticsTotals => {
  const values = row?.metricValues?.map((v) => Number(v.value)) || [];
  if (values.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error("Invalid report");
  return {
    visitors: values[0] || 0,
    sessions: values[1] || 0,
    pageviews: values[2] || 0,
  };
};
function config() {
  const property = process.env.GA_PROPERTY_ID,
    email = process.env.GA_CLIENT_EMAIL,
    privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    measurement = process.env.GA_MEASUREMENT_ID;
  return property &&
    /^\d+$/.test(property) &&
    email &&
    privateKey &&
    /^G-[A-Z0-9]+$/.test(measurement || "")
    ? { property, email, privateKey }
    : null;
}
let lastFailure = 0;
export async function getVisitorReport(period: StatisticsPeriod) {
  const c = config();
  if (!c) return { status: "unconfigured" as const };
  if (Date.now() - lastFailure < 60_000)
    return { status: "unavailable" as const };
  const today = koreanDate();
  const scope = createHash("sha256")
    .update(c.property + c.email + c.privateKey)
    .digest("hex")
    .slice(0, 16);
  try {
    return await unstable_cache(
      async (): Promise<StatisticsReport | { status: "timezone-mismatch" }> => {
        const auth = new GoogleAuth({
          credentials: { client_email: c.email, private_key: c.privateKey },
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        });
        const client = await auth.getClient();
        const ranges = reportRanges(period, today);
        const dimension =
          period === "day" ? "date" : period === "month" ? "yearMonth" : "year";
        const base = {
          metrics: [
            { name: "totalUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
          ],
          dimensionFilter: {
            filter: {
              fieldName: "hostName",
              stringFilter: { matchType: "EXACT", value: "jungwhanpark.com" },
            },
          },
          keepEmptyRows: true,
        };
        const response = await client.request<{ reports: GAReport[] }>({
          url: `https://analyticsdata.googleapis.com/v1beta/properties/${c.property}:batchRunReports`,
          method: "POST",
          timeout: 12000,
          data: {
            requests: [ranges.current, ranges.previous].flatMap((range) => [
              {
                ...base,
                dateRanges: [{ startDate: range.start, endDate: range.end }],
              },
              {
                ...base,
                dateRanges: [{ startDate: range.start, endDate: range.end }],
                dimensions: [{ name: dimension }],
                limit: 400,
                orderBys: [{ dimension: { dimensionName: dimension } }],
              },
            ]),
          },
        });
        const reports = response.data.reports;
        if (!Array.isArray(reports) || reports.length !== 4)
          throw new Error("Missing report");
        if (reports.some((r) => r.metadata?.timeZone !== "Asia/Seoul"))
          return { status: "timezone-mismatch" };
        const rangeReport = (
          range: { start: string; end: string },
          summary: GAReport,
          series: GAReport,
        ) => {
          if ((series.rowCount || 0) > 400)
            throw new Error("Report incomplete");
          const rows = new Map(
            (series.rows || []).map((row) => [
              row.dimensionValues?.[0]?.value,
              totals(row),
            ]),
          );
          return {
            ...range,
            totals: totals(summary.rows?.[0]),
            points: reportBuckets(period, range.start, range.end).map(
              (bucket) => ({
                ...bucket,
                ...(rows.get(bucket.key) || totals()),
              }),
            ),
          };
        };
        return {
          status: "ready",
          period,
          current: rangeReport(ranges.current, reports[0], reports[1]),
          previous: rangeReport(ranges.previous, reports[2], reports[3]),
          refreshedAt: new Date().toISOString(),
          timeZone: "Asia/Seoul",
          thresholded: reports.some(
            (r) =>
              !!r.metadata?.subjectToThresholding ||
              !!r.metadata?.dataLossFromOtherRow,
          ),
        };
      },
      ["visitor-report-v1", scope, period, today],
      { revalidate: 3600 },
    )();
  } catch {
    lastFailure = Date.now();
    return { status: "unavailable" as const };
  }
}
