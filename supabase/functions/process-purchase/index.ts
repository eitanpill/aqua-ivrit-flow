import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { user_id, school_id, amount, product_id } = body;

    console.log('Received purchase request:', { user_id, school_id, amount, product_id });

    // Validation: Check for required fields
    const missingFields: string[] = [];
    if (!user_id) missingFields.push('user_id');
    if (!school_id) missingFields.push('school_id');
    if (amount === undefined || amount === null) missingFields.push('amount');
    if (!product_id) missingFields.push('product_id');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          missing: missingFields 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INSERT into transactions table
    console.log('Inserting transaction...');
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id,
        school_id,
        amount,
        type: 'purchase',
        status: 'completed',
        payment_method: 'manual',
        description: `Purchase of product ${product_id}`,
        reference_id: product_id,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction insert error:', transactionError);
      return new Response(
        JSON.stringify({ error: transactionError.message, details: transactionError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transaction created:', transaction.id);

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // INSERT into invoices table
    console.log('Inserting invoice...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id,
        school_id,
        transaction_id: transaction.id,
        invoice_number: invoiceNumber,
        amount,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice insert error:', invoiceError);
      return new Response(
        JSON.stringify({ error: invoiceError.message, details: invoiceError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invoice created:', invoice.id);

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true,
        transaction_id: transaction.id,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Return RAW error message - DO NOT hide behind generic text
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, details: error }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
