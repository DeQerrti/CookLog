const SUPABASE_URL = 'https://krkuqamtppqttfnhxopp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3VxYW10cHBxdHRmbmh4b3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQ4MzgsImV4cCI6MjA5NzY2MDgzOH0.UoEj2a0V0a47AQaG54SPzQT99QHHqN3HROycLuF2ToI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
