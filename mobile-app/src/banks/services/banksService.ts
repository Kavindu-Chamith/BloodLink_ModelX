import { api } from '../../services/api';

export interface BloodStock {
  bloodGroup: string;
  units: number;
  status: 'Normal' | 'Low' | 'Critical';
  updatedAt: string;
}
export interface BloodBank {
  id: string;
  name: string;
  type: 'hospital' | 'bloodbank';
  district: string | null;
  address: string | null;
  phone: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  stocks: BloodStock[];
}
export interface BanksData { donorInitials: string; banks: BloodBank[] }

export async function fetchBloodBanks(): Promise<BanksData> {
  return (await api.authGet<BanksData>('/donors/banks')).data;
}
