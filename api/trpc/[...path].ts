import app from "../index.js";
import type { Request, Response } from "express";

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
