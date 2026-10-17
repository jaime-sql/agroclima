import { pathToFileURL } from "node:url";
import { createAskServer } from "./server.ts";

const host = process.env.HOST?.trim() || "0.0.0.0";
const port = Number(process.env.PORT ?? "8080");

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("PORT is invalid");
    process.exit(1);
  }
  const server = createAskServer();
  server.listen(port, host, () => {
    console.info("agroclima-ask listening");
  });
}
