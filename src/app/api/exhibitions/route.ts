import { recordApi } from "@/lib/record-api";
const api = recordApi("exhibitions");
export const GET = api.list;
export const POST = api.create;
