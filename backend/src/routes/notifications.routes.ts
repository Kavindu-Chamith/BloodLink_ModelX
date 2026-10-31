import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { listNotifications, readAllNotifications, readNotification, registerPushDevice, unregisterPushDevice } from '../controllers/notifications.controller';
import { validateRouteIds } from '../middleware/validation.middleware';

const router = Router();
router.use(authenticate, requireRole('donor'));
router.get('/', listNotifications);
router.patch('/read-all', readAllNotifications);
router.patch('/:id/read', validateRouteIds, readNotification);
router.post('/devices', registerPushDevice);
router.delete('/devices/:id', unregisterPushDevice);
export default router;
