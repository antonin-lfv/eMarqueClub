import { env } from "cloudflare:workers";
export function clubDb() {
  if (!env.DB) throw Error("La base de données est indisponible.");
  return env.DB;
}
