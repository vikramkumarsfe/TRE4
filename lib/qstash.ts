import { Client } from "@upstash/qstash";

let client: Client | undefined;

export function getQStashClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not configured.");
  if (!client) {
    client = new Client({
      token,
      ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}),
    });
  }
  return client;
}
