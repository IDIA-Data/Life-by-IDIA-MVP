import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Security Event Generator: Function started successfully');

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
        Deno.env.get('SUPABASE_URL') ?? '',
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event_type, source_data, priority = 'medium' } = await req.json();

    console.log('Security Event Generator: Processing event', { event_type, priority });

    // Generate security events based on different triggers
    let securityEvents = [];

    switch (event_type) {
      case 'health_data_anomaly':
        securityEvents = await generateHealthDataAnomalyEvents(source_data);
        break;
      case 'access_pattern_analysis':
        securityEvents = await generateAccessPatternEvents(source_data);
        break;
      case 'system_health_check':
        securityEvents = await generateSystemHealthEvents(source_data);
        break;
      case 'user_behavior_analysis':
        securityEvents = await generateUserBehaviorEvents(source_data);
        break;
      default:
        securityEvents = await generateGenericSecurityEvents(source_data);
    }

    // Log all generated events to security_events table
    for (const event of securityEvents) {
      await supabaseClient.from('security_events').insert({
        agent_name: 'security_event_generator',
        action_type: event.action_type,
        result_data: event.result_data,
        severity: event.severity || priority,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Security Event Generator: Generated ${securityEvents.length} security events`);

    // Trigger crazy-8-security analysis for high-priority events
    const highPriorityEvents = securityEvents.filter(e => 
      ['high', 'critical'].includes(e.severity)
    );

    for (const event of highPriorityEvents) {
      await triggerSecurityAnalysis(event);
    }

    return new Response(JSON.stringify({
      success: true,
      events_generated: securityEvents.length,
      high_priority_events: highPriorityEvents.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in Security Event Generator:', error);
    return new Response(JSON.stringify({
      error: message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateHealthDataAnomalyEvents(sourceData: any) {
  const events = [];

  // Analyze health data patterns for anomalies
  if (sourceData.unusual_activity_patterns) {
    events.push({
      action_type: 'health_anomaly_detected',
      severity: 'medium',
      result_data: {
        anomaly_type: 'activity_pattern',
        details: sourceData.unusual_activity_patterns,
        affected_users: sourceData.user_count || 1,
        confidence: 0.75
      }
    });
  }

  if (sourceData.data_quality_drops) {
    events.push({
      action_type: 'data_quality_alert',
      severity: 'high',
      result_data: {
        quality_drop_percentage: sourceData.quality_drop_percentage,
        affected_metrics: sourceData.affected_metrics,
        potential_causes: ['device_malfunction', 'sync_issues', 'user_error']
      }
    });
  }

  return events;
}

async function generateAccessPatternEvents(sourceData: any) {
  const events = [];

  if (sourceData.unusual_login_patterns) {
    events.push({
      action_type: 'suspicious_access_pattern',
      severity: 'high',
      result_data: {
        pattern_type: 'unusual_login_times',
        user_id: sourceData.user_id,
        location_changes: sourceData.location_changes,
        risk_score: 0.8
      }
    });
  }

  if (sourceData.failed_authentication_attempts > 5) {
    events.push({
      action_type: 'brute_force_attempt',
      severity: 'critical',
      result_data: {
        attempt_count: sourceData.failed_authentication_attempts,
        source_ip: sourceData.source_ip,
        time_window: sourceData.time_window
      }
    });
  }

  return events;
}

async function generateSystemHealthEvents(sourceData: any) {
  const events = [];

  if (sourceData.error_rate > 0.05) {
    events.push({
      action_type: 'high_error_rate',
      severity: 'medium',
      result_data: {
        current_error_rate: sourceData.error_rate,
        threshold: 0.05,
        affected_services: sourceData.affected_services
      }
    });
  }

  if (sourceData.performance_degradation) {
    events.push({
      action_type: 'performance_alert',
      severity: 'medium',
      result_data: {
        response_time_increase: sourceData.response_time_increase,
        affected_endpoints: sourceData.affected_endpoints
      }
    });
  }

  return events;
}

async function generateUserBehaviorEvents(sourceData: any) {
  const events = [];

  if (sourceData.unusual_data_access_patterns) {
    events.push({
      action_type: 'unusual_data_access',
      severity: 'medium',
      result_data: {
        user_id: sourceData.user_id,
        access_pattern: sourceData.access_pattern,
        data_sensitivity: sourceData.data_sensitivity
      }
    });
  }

  return events;
}

async function generateGenericSecurityEvents(sourceData: any) {
  return [{
    action_type: 'generic_security_check',
    severity: 'low',
    result_data: {
      source: 'security_event_generator',
      data: sourceData,
      generated_at: new Date().toISOString()
    }
  }];
}

async function triggerSecurityAnalysis(event: any) {
  try {
    console.log('=== TRIGGERING CRAZY-8-SECURITY ANALYSIS ===');
    console.log('High-priority event detected:', event.action_type);
    console.log('Event severity:', event.severity);
    
    // Determine which agent should handle this event
    let agent = 'crazy_sentinel'; // default
    
    if (event.action_type.includes('access') || event.action_type.includes('auth')) {
      agent = 'crazy_gatekeeper';
    } else if (event.action_type.includes('data')) {
      agent = 'crazy_shield';
    } else if (event.action_type.includes('threat') || event.action_type.includes('attack')) {
      agent = 'crazy_hunter';
    }

    console.log('Selected agent for analysis:', agent);

    const payload = {
      agent,
      action: 'analyze_security_event',
      data: event.result_data,
      context: {
        event_type: event.action_type,
        severity: event.severity,
        timestamp: new Date().toISOString()
      }
    };

    console.log('Sending request to crazy-8-security with payload:', payload);

    const response = await fetch(`https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/crazy-8-security`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status from crazy-8-security:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to trigger security analysis:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Security analysis failed: ${response.status} ${errorText}`);
    } else {
      const responseData = await response.json();
      console.log('Security analysis triggered successfully:', responseData);
      console.log('Analysis result for event:', event.action_type);
    }

  } catch (error) {
    console.error('=== ERROR IN SECURITY ANALYSIS TRIGGER ===');
    console.error('Error details:', error);
    console.error('Event that failed:', event);
    
    // Don't throw - allow the function to continue processing other events
    console.log('Continuing with other security events despite this failure');
  }
}