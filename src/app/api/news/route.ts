import { recordApi } from "@/lib/record-api";
const api = recordApi("news");
export const GET = api.list;
export const POST = api.create;
