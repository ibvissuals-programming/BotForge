import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(leadsRouter);

export default router;
