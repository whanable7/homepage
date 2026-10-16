import { recordApi } from "@/lib/record-api";
const api = recordApi("categories");
export const GET = api.list;
export const POST = api.create;
