const SUPABASE_URL = 'https://krkuqamtppqttfnhxopp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AEyt3613mjc1zUBg1jvdnA_lXzvXtKE';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
