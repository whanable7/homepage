import { recordApi } from "@/lib/record-api";
const api = recordApi("categories");
export const GET = api.get;
export const PATCH = api.patch;
export const PUT = api.patch;
export const DELETE = api.remove;
