import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://zrcpadiqlfkshhbznwao.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3BhZGlxbGZrc2hoYnpud2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODIzMzIsImV4cCI6MjA4NDY1ODMzMn0.nBe56XO1CODYNswq8pmVoOtCQbE0NjN2JFWkYs_8brA";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
