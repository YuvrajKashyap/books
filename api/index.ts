import { getRequestListener } from "@hono/node-server";
import app from "../backend/app.js";
export default getRequestListener(app.fetch);
