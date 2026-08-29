import { z } from "zod";

export const adminRoleSchema = z.enum([
  "user",
  "admin",
  "padre",
  "coordenacao",
  "coordenador",
]);