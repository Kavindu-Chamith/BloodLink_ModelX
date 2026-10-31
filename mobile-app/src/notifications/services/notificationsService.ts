import { api } from '../../services/api';
import { AppNotification } from '../types/notifications';

export async function fetchNotifications(): Promise<AppNotification[]> {
  return (await api.authGet<AppNotification[]>('/notifications')).data;
}
export async function markNotificationRead(id: string): Promise<void> {
  await api.authPatch(`/notifications/${encodeURIComponent(id)}/read`, {});
}
export async function markAllNotificationsRead(): Promise<void> {
  await api.authPatch('/notifications/read-all', {});
}
