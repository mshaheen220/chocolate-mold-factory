import cors from "cors";
import { Router } from "express";
import { TIPS } from "../data/tips";

export const tipsRouter = Router();

// Open to any origin (unlike the rest of the API, which is locked to
// config.clientOrigin) so other apps on the network can pull this list
// directly from their own frontends.
tipsRouter.get("/tips", cors(), (_req, res) => {
  res.json({ tips: TIPS });
});
