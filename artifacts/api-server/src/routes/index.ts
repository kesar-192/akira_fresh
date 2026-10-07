import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adpilotRouter from "./adpilot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adpilotRouter);

export default router;
