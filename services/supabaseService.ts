
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

// OPTIONAL: You can hardcode your Supabase URL here to avoid entering it in the UI.
// Example: "https://your-project-id.supabase.co"
export const HARDCODED_SUPABASE_URL = "https://cioqhusicycehdabgmoj.supabase.co"; 

// ---------------------

// Get keys from localStorage to allow dynamic configuration
const getSupabaseConfig = () => {
    return {
        // Prioritize the hardcoded URL, then fall back to localStorage (snake_case preferred, camelCase legacy)
        url: HARDCODED_SUPABASE_URL || localStorage.getItem('supabase_url') || localStorage.getItem('supabaseUrl') || '',
        key: localStorage.getItem('supabase_key') || localStorage.getItem('supabaseKey') || ''
    };
};

let supabase: SupabaseClient | null = null;

export const initSupabase = () => {
    const { url, key } = getSupabaseConfig();
    if (url && key) {
        supabase = createClient(url, key);
        return true;
    }
    return false;
};

export const getSupabaseClient = () => {
    if (!supabase) {
        initSupabase();
    }
    return supabase;
};

// --- Master Profile Operations ---

export const saveMasterProfileToSupabase = async (content: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured. Please check your settings.");

    // Insert new record with generated created_at
    const { data, error } = await client
        .from('master_profiles')
        .insert([{ content }])
        .select('id, content, created_at')
        .single();

    if (error) throw error;
    return data; // Returns { id, content, created_at }
};

export const getLatestMasterProfileFromSupabase = async () => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured. Please check your settings.");

    const { data, error } = await client
        .from('master_profiles')
        .select('id, content, created_at')
        .order('id', { ascending: false }) // Use ID for robust sorting (newest first)
        .limit(1)
        .single();

    if (error) throw error;
    return data; // Returns { id, content, created_at } or null
};

// --- Job Application Operations ---

export const saveJobApplicationToSupabase = async (appData: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured. Please check your settings.");

    const { data, error } = await client
        .from('job_applications')
        .insert([appData])
        .select();

    if (error) throw error;
    return data;
};
