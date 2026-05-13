import { supabase } from '@/integrations/supabase/client';

interface EventData {
  event_type: string;
  data_category: 'ai_interaction' | 'wallet' | 'social' | 'voting' | 'shopping' | 'ar_experience' | 'general';
  payload: Record<string, any>;
  session_id?: string;
  location?: { lat: number; lng: number };
}

class EventTracker {
  private sessionId: string;
  private isEnabled: boolean = true;
  private eventQueue: EventData[] = [];
  private flushInterval: number = 30000; // 30 seconds
  private batchSize: number = 10;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startAutoFlush();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startAutoFlush() {
    setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = this.eventQueue.splice(0, this.batchSize);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping event flush');
        return;
      }

      const { error } = await supabase
        .from('device_events')
        .insert(
          eventsToFlush.map(event => ({
            user_id: user.id,
            event_type: event.event_type,
            data_category: event.data_category,
            session_id: event.session_id || this.sessionId,
            json_payload: {
              ...event.payload,
              timestamp: new Date().toISOString(),
              location: event.location,
              device_info: this.getDeviceInfo()
            }
          }))
        );

      if (error) {
        console.error('Failed to flush events:', error);
        // Re-add events to queue for retry
        this.eventQueue.unshift(...eventsToFlush);
      } else {
        console.log(`Flushed ${eventsToFlush.length} events successfully`);
      }
    } catch (error) {
      console.error('Error flushing events:', error);
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  private getDeviceInfo() {
    return {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      memory_gb: (navigator as any).deviceMemory || null,
      ar_supported: 'xr' in navigator,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  // AI Interaction Tracking
  trackAIInteraction(data: {
    interaction_type: 'voice' | 'text' | 'mixed';
    conversation_length?: number;
    topics?: string[];
    satisfaction?: number;
    voice_duration?: number;
    feature?: string;
    errors?: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'ai_conversation',
      data_category: 'ai_interaction',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackAIVoiceUsage(data: {
    duration_seconds: number;
    success: boolean;
    error_type?: string;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'ai_voice_usage',
      data_category: 'ai_interaction',
      payload: data
    });
  }

  // Wallet Transaction Tracking
  trackWalletTransaction(data: {
    transaction_type: string;
    amount: number;
    currency: string;
    payment_method?: string;
    merchant_category?: string;
    frequency_score?: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'wallet_transaction',
      data_category: 'wallet',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackWalletView(data: {
    view_duration: number;
    balance_checked: boolean;
    transactions_viewed: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'wallet_view',
      data_category: 'wallet',
      payload: data
    });
  }

  // Social Interaction Tracking
  trackSocialInteraction(data: {
    interaction_type: 'friend_request' | 'trust_circle' | 'endorsement' | 'message';
    relationship_strength?: string;
    network_change?: number;
    engagement_score?: number;
    trust_change?: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'social_interaction',
      data_category: 'social',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackSocialNetworkGrowth(data: {
    new_connections: number;
    connection_type: string;
    trust_level_change: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'network_growth',
      data_category: 'social',
      payload: data
    });
  }

  // Voting/Governance Tracking
  trackVotingAction(data: {
    vote_type: 'proposal' | 'governance' | 'poll';
    category: string;
    engagement_seconds: number;
    research_actions?: string[];
    frequency_score?: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'vote_cast',
      data_category: 'voting',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackGovernanceEngagement(data: {
    proposal_viewed: boolean;
    details_read: boolean;
    time_spent_seconds: number;
    actions_taken: string[];
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'governance_engagement',
      data_category: 'voting',
      payload: data
    });
  }

  // Shopping/Commerce Tracking
  trackShoppingSession(data: {
    browse_type: 'ar_enabled' | 'traditional' | 'mixed';
    session_duration: number;
    ar_interactions: number;
    intent_score: number;
    categories: string[];
    max_price_viewed?: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'shopping_session',
      data_category: 'shopping',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackPurchaseIntent(data: {
    product_category: string;
    price_range: string;
    ar_used: boolean;
    intent_level: 'low' | 'medium' | 'high';
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'purchase_intent',
      data_category: 'shopping',
      payload: data
    });
  }

  // AR Experience Tracking
  trackARExperience(data: {
    experience_type: string;
    duration: number;
    engagement_score: number;
    conversion: boolean;
    completion_rate: number;
    shared: boolean;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'ar_experience',
      data_category: 'ar_experience',
      payload: data
    });

    if (this.eventQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackARInteraction(data: {
    interaction_type: string;
    duration_seconds: number;
    success: boolean;
    business_context?: string;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'ar_interaction',
      data_category: 'ar_experience',
      payload: data
    });
  }

  // General App Usage Tracking
  trackPageView(data: {
    page: string;
    duration?: number;
    referrer?: string;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'page_view',
      data_category: 'general',
      payload: data
    });
  }

  trackFeatureUsage(data: {
    feature: string;
    action: string;
    duration?: number;
    success: boolean;
    context?: Record<string, any>;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'feature_usage',
      data_category: 'general',
      payload: data
    });
  }

  trackAppSession(data: {
    session_start: Date;
    session_end?: Date;
    actions_count: number;
    features_used: string[];
    errors_encountered: number;
  }) {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event_type: 'app_session',
      data_category: 'general',
      payload: {
        ...data,
        duration: data.session_end ? 
          (data.session_end.getTime() - data.session_start.getTime()) / 1000 : 0
      }
    });
  }

  // Utility methods
  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  async forceFlush() {
    await this.flushEvents();
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  clearQueue() {
    this.eventQueue = [];
  }

  // Location tracking
  async trackWithLocation(eventData: EventData) {
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000 // 5 minutes
          });
        });

        eventData.location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      } catch (error) {
        console.log('Location tracking failed:', error);
      }
    }

    this.eventQueue.push(eventData);
  }
}

// Global event tracker instance
export const eventTracker = new EventTracker();

// Export types for use in components
export type { EventData };
export default EventTracker;