import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import leadsRouter from "./leads";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(leadsRouter);
router.use(authRouter);

export default router;
