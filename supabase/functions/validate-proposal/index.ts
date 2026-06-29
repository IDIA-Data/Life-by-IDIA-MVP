
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard - require valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { proposalId, title, description, category } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // AI validation prompt
    const validationPrompt = `
You are an AI validator for governance proposals in a data monetization platform. 
Analyze this proposal and determine if it's:
1. Spam or low-quality (score 0-3)
2. Repetitive or already commonly suggested (score 4-6) 
3. Valid and constructive suggestion (score 7-10)

Proposal:
Title: ${title}
Description: ${description}
Category: ${category}

Provide a score (0-10) and brief feedback explaining your reasoning. Focus on:
- Is this a legitimate governance suggestion?
- Does it provide clear value to the platform?
- Is it specific and actionable?
- Is it spam, promotional, or off-topic?

Respond with a JSON object: {"score": number, "feedback": "explanation"}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a governance proposal validator. Always respond with valid JSON.' },
          { role: 'user', content: validationPrompt }
        ],
        temperature: 0.3,
      }),
    });

    const aiResponse = await response.json();
    const validationResult = JSON.parse(aiResponse.choices[0].message.content);

    // Update the proposal with AI validation results (best-effort; tolerate missing columns)
    const score = Number(validationResult.score);
    const nextStatus = score >= 7 ? 'active' : score >= 4 ? 'under_review' : 'rejected';
    const updatePayload: Record<string, unknown> = { status: nextStatus };
    try {
      (updatePayload as any).ai_validation_score = score;
      (updatePayload as any).ai_validation_feedback = validationResult.feedback;
    } catch (_) { /* noop */ }

    const { error } = await supabase
      .from('dao_proposals')
      .update(updatePayload)
      .eq('id', proposalId);

    if (error) console.warn('validate-proposal update warning:', error.message);


    return new Response(JSON.stringify({ 
      score: validationResult.score, 
      feedback: validationResult.feedback,
      status: validationResult.score >= 7 ? 'approved' : validationResult.score >= 4 ? 'under_review' : 'rejected'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in validate-proposal function:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
