import { api, resolveApiUrl } from '../../services/api';
import { DonationHistoryData } from '../types/history';

export async function fetchDonationHistory(): Promise<DonationHistoryData> {
  return (await api.authGet<DonationHistoryData>('/donors/me/donations')).data;
}
export async function fetchDonorRecordUrl(): Promise<string | null> {
  const result = (await api.authGet<{ url: string }>('/donors/me/donation-record')).data;
  return result.url ? resolveApiUrl(result.url) : null;
}
