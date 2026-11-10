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
export async function fetchPrivateHealthMessage(id: string): Promise<{ subject: string; message: string; institution: string }> {
  return (await api.authGet<{ alert: { subject: string; message: string; institution: string } }>(`/notifications/${encodeURIComponent(id)}/health-message`)).data.alert;
}
