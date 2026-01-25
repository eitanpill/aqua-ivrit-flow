// Payment Provider Interface & Mock Logic
export type PaymentProvider = 'stripe' | 'tranzila' | 'cardcom' | 'generic';

export interface PaymentConfig {
  id: string;
  school_id: string;
  provider_name: PaymentProvider;
  api_key_masked: string;
  has_secret: boolean;
  is_active: boolean;
  plugin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  message: string;
  transactionId?: string;
  error?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  school_id: string;
  description?: string;
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the active payment configuration for a school (masked keys only)
 */
export async function getPaymentConfigs(schoolId: string): Promise<PaymentConfig[]> {
  const { data, error } = await supabase.rpc('get_payment_configs', {
    p_school_id: schoolId
  });

  if (error) {
    console.error('Error fetching payment configs:', error);
    throw new Error('שגיאה בטעינת הגדרות התשלום');
  }

  return (data || []) as PaymentConfig[];
}

/**
 * Gets the active payment configuration status for a school
 */
export async function getActivePaymentConfig(schoolId: string): Promise<{
  success: boolean;
  provider?: PaymentProvider;
  key_masked?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('get_active_payment_config', {
    p_school_id: schoolId
  });

  if (error) {
    console.error('Error fetching active payment config:', error);
    return { success: false, error: 'שגיאה בטעינת הגדרות התשלום' };
  }

  return data as {
    success: boolean;
    provider?: PaymentProvider;
    key_masked?: string;
    error?: string;
  };
}

/**
 * Process a payment (mock implementation)
 * This interface should be implemented for each payment provider
 */
export async function processPayment(request: PaymentRequest): Promise<ProcessPaymentResult> {
  const { amount, currency, school_id, description } = request;

  // Step 1: Fetch active config for the school
  const config = await getActivePaymentConfig(school_id);

  // Step 2: Check if config exists
  if (!config.success || !config.provider) {
    console.error('Payment failed: No active payment provider configured');
    return {
      success: false,
      message: 'לא הוגדר ספק תשלומים',
      error: config.error || 'לא הוגדר ספק תשלומים פעיל לבית הספר'
    };
  }

  // Step 3: Mock processing - log the transaction
  const mockTransactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  console.log(`🔵 Processing Payment:`);
  console.log(`   Amount: ${amount} ${currency}`);
  console.log(`   Provider: ${config.provider}`);
  console.log(`   Key: ${config.key_masked}`);
  console.log(`   Description: ${description || 'N/A'}`);
  console.log(`   Transaction ID: ${mockTransactionId}`);

  // Mock success response
  return {
    success: true,
    message: `תשלום של ${amount} ${currency} בוצע בהצלחה דרך ${getProviderDisplayName(config.provider)}`,
    transactionId: mockTransactionId
  };
}

/**
 * Get display name for payment provider
 */
export function getProviderDisplayName(provider: PaymentProvider): string {
  const names: Record<PaymentProvider, string> = {
    stripe: 'Stripe',
    tranzila: 'Tranzila',
    cardcom: 'CardCom',
    generic: 'כללי'
  };
  return names[provider] || provider;
}

/**
 * Add or update payment configuration
 */
export async function upsertPaymentConfig(
  schoolId: string,
  provider: PaymentProvider,
  apiKey: string,
  apiSecret?: string,
  pluginId?: string
): Promise<{ success: boolean; error?: string }> {
  // First try to update existing
  const { data: existing } = await supabase
    .from('payment_configs')
    .select('id')
    .eq('school_id', schoolId)
    .eq('provider_name', provider)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('payment_configs')
      .update({
        api_key: apiKey,
        api_secret: apiSecret || null,
        plugin_id: pluginId || null,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating payment config:', error);
      return { success: false, error: 'שגיאה בעדכון הגדרות התשלום' };
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from('payment_configs')
      .insert({
        school_id: schoolId,
        provider_name: provider,
        api_key: apiKey,
        api_secret: apiSecret || null,
        plugin_id: pluginId || null,
        is_active: true
      });

    if (error) {
      console.error('Error inserting payment config:', error);
      return { success: false, error: 'שגיאה בהוספת הגדרות התשלום' };
    }
  }

  // Deactivate other providers for this school
  await supabase
    .from('payment_configs')
    .update({ is_active: false })
    .eq('school_id', schoolId)
    .neq('provider_name', provider);

  return { success: true };
}

/**
 * Delete a payment configuration
 */
export async function deletePaymentConfig(configId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('payment_configs')
    .delete()
    .eq('id', configId);

  if (error) {
    console.error('Error deleting payment config:', error);
    return { success: false, error: 'שגיאה במחיקת הגדרות התשלום' };
  }

  return { success: true };
}
