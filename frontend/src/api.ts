import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('totem_cmds_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getPdfDownloadUrl(pathUrl: string): string {
  const token = localStorage.getItem('totem_cmds_token') || '';
  const sep = pathUrl.includes('?') ? '&' : '?';
  return `/api${pathUrl}${sep}token=${encodeURIComponent(token)}`;
}
