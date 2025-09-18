import { http } from '../lib/http';

export async function getKpis() {
  const { data } = await http.get('/health');
  return data;
}
