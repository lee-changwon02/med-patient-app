import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

export interface RemoteRecord {
  id: string;
  patient_token: string;
  record_type: 'medication' | 'checkin' | 'checkup';
  payload: Record<string, unknown>;
  created_at: string;
}

export async function createPatient(token: string, display_name: string) {
  const { error } = await supabase.from('patients').insert({
    token,
    display_name,
    created_at: new Date().toISOString(),
  });
  return error;
}

export async function insertRecord(
  patient_token: string,
  record_type: 'medication' | 'checkin' | 'checkup',
  payload: Record<string, unknown>
): Promise<{ id: string | null; error: unknown }> {
  const { data, error } = await supabase
    .from('records')
    .insert({ patient_token, record_type, payload, created_at: new Date().toISOString() })
    .select('id')
    .single();
  return { id: (data as { id: string } | null)?.id ?? null, error };
}

export async function deleteRecord(id: string): Promise<unknown> {
  const { error } = await supabase.from('records').delete().eq('id', id);
  return error;
}

// Deletes any existing record for the same patient/date/med/schedule, then inserts.
// Prevents duplicate medication entries when status changes multiple times in a day.
export async function upsertMedRecord(
  patient_token: string,
  date: string,
  payload: Record<string, unknown>
): Promise<{ id: string | null; error: unknown }> {
  await supabase
    .from('records')
    .delete()
    .eq('patient_token', patient_token)
    .eq('record_type', 'medication')
    .eq('payload->>medicationId', payload.medicationId as string)
    .eq('payload->>scheduleLabel', payload.scheduleLabel as string)
    .gte('created_at', date + 'T00:00:00')
    .lte('created_at', date + 'T23:59:59');
  return insertRecord(patient_token, 'medication', payload);
}

export async function fetchTodayRecords(
  patient_token: string
): Promise<{ data: RemoteRecord[] | null; error: unknown }> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('patient_token', patient_token)
    .gte('created_at', today + 'T00:00:00')
    .lte('created_at', today + 'T23:59:59')
    .order('created_at', { ascending: false });
  return { data: data as RemoteRecord[] | null, error };
}

export async function fetchRecordsByType(
  patient_token: string,
  record_type: 'checkin' | 'checkup',
  limit = 100
): Promise<{ data: RemoteRecord[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('patient_token', patient_token)
    .eq('record_type', record_type)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data as RemoteRecord[] | null, error };
}
