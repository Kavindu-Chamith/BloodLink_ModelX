import { Platform } from 'react-native';
import { api } from '../../services/api';
import { DonorProfile, EditableProfileFields, PickedFile } from '../types/profile';

export async function fetchMyProfile(): Promise<DonorProfile> {
  return (await api.authGet<DonorProfile>('/donors/me')).data;
}
export async function updateMyProfile(fields: EditableProfileFields): Promise<DonorProfile> {
  return (await api.authPatch<DonorProfile>('/donors/me', fields)).data;
}
export async function setMyAvailability(isAvailable: boolean): Promise<DonorProfile> {
  return (await api.authPatch<DonorProfile>('/donors/me/availability', { isAvailable })).data;
}
export async function updateMatchingLocation(latitude: number | null, longitude: number | null): Promise<DonorProfile> {
  return (await api.authPatch<DonorProfile>('/donors/me', { latitude, longitude })).data;
}
export async function uploadVerificationDocument(file: PickedFile): Promise<DonorProfile> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    if (!response.ok) throw new Error('Could not read the selected file.');
    form.append('document', await response.blob(), file.name);
  } else {
    form.append('document', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  return (await api.authUpload<DonorProfile>('/donors/me/verification-documents', form)).data;
}
