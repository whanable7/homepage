import { cache } from "react";
import { readDocument } from "./archive-store";
import { appearanceSeed } from "./appearance";
export const getAppearance = cache(() =>
  readDocument("appearance", appearanceSeed()),
);
