import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import leadsRouter from "./leads";
import authRouter from "./auth";
import businessesRouter from "./businesses";
import promoRouter from "./promo";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(leadsRouter);
router.use(authRouter);
router.use(businessesRouter);
router.use(promoRouter);
router.use(statsRouter);
router.use(adminRouter);

export default router;
