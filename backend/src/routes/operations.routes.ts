import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { institutionOverview, listTeammates, createTeammate, setTeammateStatus, listStocks, updateStock } from '../controllers/operations.controller';
import { validateRouteIds } from '../middleware/validation.middleware';

export const institutionRoutes = Router();
institutionRoutes.use(authenticate, requireRole('hospital_staff', 'bloodbank_staff'));
institutionRoutes.get('/overview', institutionOverview);
institutionRoutes.get('/staff', listTeammates);
institutionRoutes.post('/staff', createTeammate);
institutionRoutes.patch('/staff/:id/status', validateRouteIds, setTeammateStatus);

export const stockRoutes = Router();
stockRoutes.use(authenticate, requireRole('hospital_staff', 'bloodbank_staff'));
stockRoutes.get('/', listStocks);
stockRoutes.put('/:bloodGroup', updateStock);
