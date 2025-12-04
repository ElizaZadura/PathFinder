import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get keys from localStorage to allow dynamic configuration
const getSupabaseConfig = () => {
    return {
        url: localStorage.getItem('supabaseUrl') || '',
        key: localStorage.getItem('supabaseKey') || ''
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

    // Simple strategy: Always create a new entry for history, or you could update a single row
    // Here we insert a new record to keep a version history
    const { data, error } = await client
        .from('master_profiles')
        .insert([{ content }])
        .select();

    if (error) throw error;
    return data;
};

export const getLatestMasterProfileFromSupabase = async () => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured. Please check your settings.");

    const { data, error } = await client
        .from('master_profiles')
        .select('content')
        .order('id', { ascending: false }) // Use ID for robust sorting (newest first)
        .limit(1)
        .single();

    if (error) throw error;
    return data?.content;
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