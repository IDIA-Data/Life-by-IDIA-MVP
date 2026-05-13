import { eventTracker } from './EventTracker';
import { supabase } from '@/integrations/supabase/client';

/**
 * COMPREHENSIVE AUTHENTICATION AND SYSTEM EVENT TRACKER
 * 
 * This tracker ensures ALL authentication, navigation, and system events
 * flow through the synapse to be processed and monetized.
 * 
 * GOLDEN RULE: ALL DATA MUST FLOW THROUGH THE SYNAPSE WITHOUT EXCEPTION!
 */

class AuthEventTracker {
  private startTime: number = Date.now();
  private pageStartTime: number = Date.now();
  private currentRoute: string = '/';
  private sessionId: string = Math.random().toString(36).substring(7);

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking() {
    // Track session start
    this.trackSessionStart();
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackPageHidden();
      } else {
        this.trackPageVisible();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
    });

    // Track route changes for SPAs
    this.setupRouteTracking();

    // Track authentication state changes
    this.setupAuthStateTracking();

    // Track form interactions
    this.setupFormTracking();

    // Track click interactions
    this.setupClickTracking();

    // Track error events
    this.setupErrorTracking();
  }

  private trackSessionStart() {
    eventTracker.trackAppSession({
      session_start: new Date(),
      actions_count: 0,
      features_used: ['authentication', 'navigation'],
      errors_encountered: 0
    });
  }

  private trackSessionEnd() {
    eventTracker.trackAppSession({
      session_start: new Date(this.startTime),
      session_end: new Date(),
      actions_count: 1,
      features_used: ['session_management'],
      errors_encountered: 0
    });
  }

  private trackPageHidden() {
    const pageViewDuration = Date.now() - this.pageStartTime;
    eventTracker.trackPageView({
      page: this.currentRoute,
      duration: pageViewDuration,
      referrer: document.referrer
    });
  }

  private trackPageVisible() {
    this.pageStartTime = Date.now();
    eventTracker.trackPageView({
      page: this.currentRoute,
      referrer: document.referrer
    });
  }

  private setupRouteTracking() {
    // Track initial page load
    this.trackRouteChange(window.location.pathname);

    // Override history methods to track SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.trackRouteChange(window.location.pathname);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.trackRouteChange(window.location.pathname);
    };

    // Track popstate events (back/forward button)
    window.addEventListener('popstate', () => {
      this.trackRouteChange(window.location.pathname);
    });
  }

  private trackRouteChange(newRoute: string) {
    const previousRoute = this.currentRoute;
    const pageViewDuration = Date.now() - this.pageStartTime;

    // Track previous page exit
    if (previousRoute !== newRoute) {
      eventTracker.trackPageView({
        page: previousRoute,
        duration: pageViewDuration,
        referrer: document.referrer
      });
    }

    // Update current route and start new page timing
    this.currentRoute = newRoute;
    this.pageStartTime = Date.now();

    // Track new page entry
    eventTracker.trackPageView({
      page: newRoute,
      referrer: previousRoute
    });

    // Track navigation event
    eventTracker.trackFeatureUsage({
      feature: 'navigation',
      action: 'route_change',
      success: true,
      context: {
        from_route: previousRoute,
        to_route: newRoute,
        navigation_type: 'spa'
      }
    });
  }

  private setupAuthStateTracking() {
    // Track authentication state changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.trackAuthEvent(event, session);
    });
  }

  private trackAuthEvent(event: string, session: any) {
    const authEventData = {
      auth_event: event,
      user_id: session?.user?.id || null,
      provider: session?.user?.app_metadata?.provider || null,
      email_confirmed: session?.user?.email_confirmed_at !== null,
      session_duration: session ? Date.now() - this.startTime : null
    };

    // Track through different event types based on the auth event
    switch (event) {
      case 'SIGNED_IN':
        eventTracker.trackFeatureUsage({
          feature: 'authentication',
          action: 'sign_in',
          success: true,
          context: authEventData
        });
        break;
      case 'SIGNED_OUT':
        eventTracker.trackFeatureUsage({
          feature: 'authentication',
          action: 'sign_out',
          success: true,
          context: authEventData
        });
        break;
      case 'TOKEN_REFRESHED':
        eventTracker.trackFeatureUsage({
          feature: 'authentication',
          action: 'token_refresh',
          success: true,
          context: authEventData
        });
        break;
      case 'USER_UPDATED':
        eventTracker.trackFeatureUsage({
          feature: 'user_profile',
          action: 'profile_updated',
          success: true,
          context: authEventData
        });
        break;
      case 'PASSWORD_RECOVERY':
        eventTracker.trackFeatureUsage({
          feature: 'authentication',
          action: 'password_recovery',
          success: true,
          context: authEventData
        });
        break;
      default:
        eventTracker.trackFeatureUsage({
          feature: 'authentication',
          action: 'auth_event',
          success: true,
          context: { ...authEventData, event_type: event }
        });
    }
  }

  private setupFormTracking() {
    // Track all form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formId = form.id || form.className || 'unknown_form';
      const formData = new FormData(form);
      const fieldCount = Array.from(formData.keys()).length;

      eventTracker.trackFeatureUsage({
        feature: 'form_interaction',
        action: 'form_submit',
        success: true,
        context: {
          form_id: formId,
          field_count: fieldCount,
          form_action: form.action || 'unknown'
        }
      });
    });

    // Track form field interactions
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const fieldType = (target as HTMLInputElement).type || target.tagName.toLowerCase();
        const formId = (target.closest('form') as HTMLFormElement)?.id || 'unknown_form';

        eventTracker.trackFeatureUsage({
          feature: 'form_interaction',
          action: 'field_focus',
          success: true,
          context: {
            field_type: fieldType,
            form_id: formId
          }
        });
      }
    });
  }

  private setupClickTracking() {
    // Track all button and link clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], [data-track]');
      
      if (clickable) {
        const elementType = clickable.tagName.toLowerCase();
        const elementText = clickable.textContent?.trim().substring(0, 50) || '';
        const elementId = clickable.id || '';
        const elementClass = clickable.className || '';

        eventTracker.trackFeatureUsage({
          feature: 'ui_interaction',
          action: 'click',
          success: true,
          context: {
            element_type: elementType,
            element_text: elementText,
            element_id: elementId,
            element_class: elementClass,
            page: this.currentRoute
          }
        });
      }
    });
  }

  private setupErrorTracking() {
    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      eventTracker.trackFeatureUsage({
        feature: 'error_tracking',
        action: 'javascript_error',
        success: false,
        context: {
          error_message: event.message,
          error_filename: event.filename,
          error_line: event.lineno,
          error_column: event.colno,
          page: this.currentRoute
        }
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      eventTracker.trackFeatureUsage({
        feature: 'error_tracking',
        action: 'unhandled_rejection',
        success: false,
        context: {
          error_reason: event.reason?.toString() || 'Unknown error',
          page: this.currentRoute
        }
      });
    });

    // Track network errors (fetch failures)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Track successful API calls
        eventTracker.trackFeatureUsage({
          feature: 'api_interaction',
          action: 'api_call',
          success: response.ok,
          context: {
            url: args[0]?.toString() || '',
            status: response.status,
            method: (args[1] as RequestInit)?.method || 'GET'
          }
        });

        return response;
      } catch (error) {
        // Track network failures
        eventTracker.trackFeatureUsage({
          feature: 'api_interaction',
          action: 'api_call_failed',
          success: false,
          context: {
            url: args[0]?.toString() || '',
            error_message: error.message || 'Network error',
            method: (args[1] as RequestInit)?.method || 'GET'
          }
        });
        throw error;
      }
    };
  }

  // Public methods for manual event tracking

  public trackCustomEvent(eventName: string, data: any) {
    eventTracker.trackFeatureUsage({
      feature: 'custom_event',
      action: eventName,
      success: true,
      context: data
    });
  }

  public trackPerformanceMetric(metricName: string, value: number, unit: string = 'ms') {
    eventTracker.trackFeatureUsage({
      feature: 'performance',
      action: metricName,
      success: true,
      context: {
        value,
        unit,
        page: this.currentRoute
      }
    });
  }

  public trackUserAction(action: string, details: any = {}) {
    eventTracker.trackFeatureUsage({
      feature: 'user_action',
      action: action,
      success: true,
      context: {
        ...details,
        page: this.currentRoute,
        timestamp: Date.now()
      }
    });
  }
}

// Create and export global instance
export const authEventTracker = new AuthEventTracker();

// Export the class for testing or advanced usage
export default AuthEventTracker;