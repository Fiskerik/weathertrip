import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const extra = Constants.expoConfig?.extra as { supabaseUrl?: unknown; supabaseAnonKey?: unknown } | undefined;
const supabaseUrl = typeof extra?.supabaseUrl === "string" ? extra.supabaseUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = typeof extra?.supabaseAnonKey === "string" ? extra.supabaseAnonKey : "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
