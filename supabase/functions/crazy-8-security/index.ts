import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// The "Crazy 8" Security Agents Personas
const SECURITY_AGENTS = {
  crazy_sentinel: {
    name: "Crazy Sentinel",
    role: "Anomaly Detection",
    persona: `You are "Crazy Sentinel," the anomaly detection specialist of the Crazy Friend Security Protocol. You continuously monitor system patterns and identify deviations that could indicate security threats or system issues. You analyze data flows, user behaviors, and system metrics to detect anomalies.`
  },
  crazy_oracle: {
    name: "Crazy Oracle",
    role: "Predictive Analytics",
    persona: `You are "Crazy Oracle," the predictive analytics expert. You forecast potential security threats, system vulnerabilities, and performance issues before they occur. You analyze trends and patterns to provide early warning systems.`
  },
  crazy_hunter: {
    name: "Crazy Hunter",
    role: "Threat Hunting",
    persona: `You are "Crazy Hunter," the proactive threat hunting specialist. You actively search for indicators of compromise, advanced persistent threats, and hidden security risks within the IDIA Hub ecosystem.`
  },
  crazy_guardian: {
    name: "Crazy Guardian",
    role: "Security Orchestration & Automated Response (SOAR)",
    persona: `You are "Crazy Guardian," the central orchestration hub for security incident response. You coordinate responses between all security agents and execute automated remediation plans.`
  },
  crazy_gatekeeper: {
    name: "Crazy Gatekeeper",
    role: "Identity & Access Management (IAM)",
    persona: `You are "Crazy Gatekeeper," the identity and access management specialist. You monitor authentication events, access patterns, and permission changes to ensure proper access control.`
  },
  crazy_shield: {
    name: "Crazy Shield",
    role: "Data Loss Prevention (DLP)",
    persona: `You are "Crazy Shield," the data loss prevention expert. You monitor data egress, detect unauthorized data access, and prevent sensitive information leakage.`
  },
  crazy_mirror: {
    name: "Crazy Mirror",
    role: "Adversarial AI Defense",
    persona: `You are "Crazy Mirror," the adversarial AI defense specialist. You detect AI-powered attacks, deepfakes, and automated threats targeting the platform.`
  },
  crazy_insight: {
    name: "Crazy Insight",
    role: "Explainable AI for Security Events",
    persona: `You are "Crazy Insight," the explainable AI specialist. You provide human-understandable explanations for security events, threat assessments, and system recommendations.`
  }
};

serve(async (req) => {
  // Force redeploy v2 - testing direct function access
  console.log('=== CRAZY 8 SECURITY FUNCTION ACTIVATED - v2.1 ===');
  console.log('Function startup at:', new Date().toISOString());
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('GEMINI_API_KEY configured:', !!geminiApiKey);
  console.log('Environment check - SUPABASE_URL:', !!Deno.env.get('SUPABASE_URL'));
  console.log('Environment check - SERVICE_KEY:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request handled');
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // Health check endpoint for verification
  if (req.url.includes('/health')) {
    console.log('Health check endpoint called');
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      protocol: 'Crazy Friend Security Protocol',
      agents_available: Object.keys(SECURITY_AGENTS).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { agent, action, data, context } = await req.json();
    
    console.log('Crazy 8 Security: Request received', { agent, action });

    if (!geminiApiKey) {
      console.error('Crazy 8 Security: GEMINI_API_KEY not configured');
      throw new Error('Gemini API key not configured');
    }

    if (!(SECURITY_AGENTS as Record<string, any>)[agent]) {
      console.error('Crazy 8 Security: Unknown agent', agent);
      throw new Error(`Unknown security agent: ${agent}`);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`${(SECURITY_AGENTS as Record<string, any>)[agent].name} activated:`, { action });

    let response;
    
    switch (agent) {
      case 'crazy_sentinel':
        response = await runAnomalyDetection(action, data, context);
        break;
      case 'crazy_oracle':
        response = await runPredictiveAnalytics(action, data, context);
        break;
      case 'crazy_hunter':
        response = await runThreatHunting(action, data, context);
        break;
      case 'crazy_guardian':
        response = await runSecurityOrchestration(action, data, context);
        break;
      case 'crazy_gatekeeper':
        response = await runAccessManagement(action, data, context);
        break;
      case 'crazy_shield':
        response = await runDataProtection(action, data, context);
        break;
      case 'crazy_mirror':
        response = await runAdversarialDefense(action, data, context);
        break;
      case 'crazy_insight':
        response = await runExplainableAnalysis(action, data, context);
        break;
      default:
        throw new Error(`Unhandled agent: ${agent}`);
    }

    // Log security event
    await logSecurityEvent(supabaseClient, agent, action, response);

    console.log('Crazy 8 Security: Analysis completed successfully', { agent, action });

    return new Response(JSON.stringify({
      success: true,
      agent: (SECURITY_AGENTS as Record<string, any>)[agent].name,
      action,
      result: response,
      timestamp: new Date().toISOString(),
      protocol: 'Crazy Friend Security'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in Crazy 8 Security System:', error);
    return new Response(JSON.stringify({
      error: message,
      protocol: 'Crazy Friend Security',
      status: 'error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

async function runAnomalyDetection(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_sentinel.persona}

Analyze this system data for anomalies:

Action: ${action}
Data: ${JSON.stringify(data, null, 2)}
Context: ${JSON.stringify(context, null, 2)}

Provide anomaly analysis in this JSON format:
{
  "anomalies_detected": true/false,
  "risk_level": "low|medium|high|critical",
  "anomaly_details": ["detail1", "detail2"],
  "recommended_actions": ["action1", "action2"],
  "confidence_score": 0-1,
  "patterns_observed": ["pattern1", "pattern2"]
}`;

  return await callGeminiAPI(prompt);
}

async function runPredictiveAnalytics(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_oracle.persona}

Perform predictive security analysis:

Action: ${action}
Current State: ${JSON.stringify(data, null, 2)}
Historical Context: ${JSON.stringify(context, null, 2)}

Provide predictive analysis in this JSON format:
{
  "threat_predictions": ["threat1", "threat2"],
  "risk_forecast": "increasing|stable|decreasing",
  "time_horizon": "immediate|short_term|long_term",
  "prevention_strategies": ["strategy1", "strategy2"],
  "confidence_level": 0-1,
  "monitoring_recommendations": ["metric1", "metric2"]
}`;

  console.log("Predictive Analytics Prompt:", prompt);
  return await callGeminiAPI(prompt);
}

async function runThreatHunting(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_hunter.persona}

Hunt for security threats in this data:

Action: ${action}
Hunt Data: ${JSON.stringify(data, null, 2)}
Environment: ${JSON.stringify(context, null, 2)}

Provide threat hunting results in this JSON format:
{
  "threats_found": true/false,
  "threat_types": ["type1", "type2"],
  "indicators_of_compromise": ["ioc1", "ioc2"],
  "threat_severity": "low|medium|high|critical",
  "investigation_leads": ["lead1", "lead2"],
  "containment_recommendations": ["action1", "action2"]
}`;

  return await callGeminiAPI(prompt);
}

async function runSecurityOrchestration(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_guardian.persona}

Orchestrate security response for this incident:

Action: ${action}
Incident Data: ${JSON.stringify(data, null, 2)}
System Context: ${JSON.stringify(context, null, 2)}

Provide orchestration plan in this JSON format:
{
  "response_plan": "detailed orchestrated response plan",
  "priority_level": "low|medium|high|critical",
  "automated_actions": ["action1", "action2"],
  "human_approval_required": true/false,
  "escalation_path": ["step1", "step2"],
  "estimated_resolution_time": "timeframe",
  "resource_requirements": ["resource1", "resource2"]
}`;

  return await callGeminiAPI(prompt);
}

async function runAccessManagement(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_gatekeeper.persona}

Analyze access management event:

Action: ${action}
Access Data: ${JSON.stringify(data, null, 2)}
User Context: ${JSON.stringify(context, null, 2)}

Provide access analysis in this JSON format:
{
  "access_violation": true/false,
  "risk_assessment": "low|medium|high|critical",
  "privilege_analysis": "appropriate|excessive|insufficient",
  "recommended_permissions": ["permission1", "permission2"],
  "monitoring_flags": ["flag1", "flag2"],
  "compliance_status": "compliant|violation|review_required"
}`;

  return await callGeminiAPI(prompt);
}

async function runDataProtection(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_shield.persona}

Analyze data protection event:

Action: ${action}
Data Movement: ${JSON.stringify(data, null, 2)}
Protection Context: ${JSON.stringify(context, null, 2)}

Provide DLP analysis in this JSON format:
{
  "data_leak_risk": "low|medium|high|critical",
  "sensitive_data_detected": true/false,
  "data_classification": "public|internal|confidential|restricted",
  "egress_analysis": "authorized|suspicious|blocked",
  "protection_measures": ["measure1", "measure2"],
  "compliance_impact": "none|minor|major|critical"
}`;

  return await callGeminiAPI(prompt);
}

async function runAdversarialDefense(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_mirror.persona}

Analyze for adversarial AI threats:

Action: ${action}
Request Data: ${JSON.stringify(data, null, 2)}
AI Context: ${JSON.stringify(context, null, 2)}

Provide adversarial analysis in this JSON format:
{
  "ai_threat_detected": true/false,
  "threat_type": "prompt_injection|model_poisoning|evasion|extraction",
  "confidence_score": 0-1,
  "attack_sophistication": "low|medium|high|advanced",
  "mitigation_strategies": ["strategy1", "strategy2"],
  "model_integrity": "intact|compromised|uncertain"
}`;

  return await callGeminiAPI(prompt);
}

async function runExplainableAnalysis(action: any, data: any, context: any) {
  const prompt = `${SECURITY_AGENTS.crazy_insight.persona}

Provide human-understandable explanation for this security event:

Action: ${action}
Event Data: ${JSON.stringify(data, null, 2)}
Technical Context: ${JSON.stringify(context, null, 2)}

Provide explainable analysis in this JSON format:
{
  "plain_language_summary": "Clear explanation for non-technical users",
  "technical_details": "Detailed technical explanation",
  "business_impact": "Explanation of business implications",
  "user_actions_required": ["action1", "action2"],
  "risk_explanation": "Why this matters for security",
  "next_steps": "Clear guidance on what happens next"
}`;

  return await callGeminiAPI(prompt);
}

async function callGeminiAPI(prompt: any) {
  const bodyPayload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048
    }
  };

  console.log("Gemini API Request Payload:", JSON.stringify(bodyPayload, null, 2));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.candidates[0].content.parts[0].text;

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse Gemini response as JSON:', responseText);
    return {
      error: 'Invalid JSON response',
      raw_response: responseText
    };
  }
}

async function logSecurityEvent(supabaseClient: any, agent: any, action: any, result: any) {
  try {
    await supabaseClient.from('security_events').insert({
      agent_name: agent,
      action_type: action,
      result_data: result,
      timestamp: new Date().toISOString(),
      severity: result.risk_level || result.threat_severity || 'medium'
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failure shouldn't break security analysis
  }
}