import { FriendState, OrbStyling } from './types';

/**
 * PRODUCTION-GRADE ORB STYLING
 * Aligned with IDIA Life branding (Teal/Orange/Black)
 * Maps CSS visual states to the 3D WebGL experience
 */
export const getOrbStyling = (friendState: FriendState, isBlinking?: boolean): OrbStyling => {
  console.log(`=== [STYLING_SYNC_START] Computing visual state for: ${friendState} ===`);
  
  let styles: OrbStyling;

  switch (friendState) {
    case 'idle':
      styles = {
        // IDIA Teal breathing state
        background: 'bg-gradient-to-br from-teal-400 via-teal-600 to-slate-900',
        animation: 'animate-[pulse_4s_ease-in-out_infinite]', 
        glow: 'shadow-2xl shadow-teal-500/30 backdrop-blur-md border border-white/20',
        scale: 'scale-100'
      };
      break;
    case 'listening':
      styles = {
        // Ingesting data state
        background: 'bg-gradient-radial from-teal-300 via-teal-500 to-teal-900',
        animation: 'animate-pulse',
        glow: 'shadow-[0_0_40px_rgba(20,184,166,0.5)] backdrop-blur-sm border border-teal-200/50',
        scale: 'scale-110'
      };
      break;
    case 'thinking':
      styles = {
        // Deep integration state (Purple/Indigo)
        background: 'bg-gradient-to-tr from-indigo-500 via-purple-600 to-slate-900',
        animation: 'animate-spin-slow',
        glow: 'shadow-2xl shadow-purple-500/40 backdrop-blur-xl',
        scale: 'scale-105'
      };
      break;
    case 'speaking':
      styles = {
        // Projecting intelligence state (Orange/Yellow)
        background: 'bg-gradient-to-br from-orange-300 via-orange-500 to-rose-700',
        animation: isBlinking ? 'animate-pulse' : '',
        glow: 'shadow-[0_0_50px_rgba(249,115,22,0.4)] backdrop-blur-md border border-orange-200/30',
        scale: 'scale-115'
      };
      break;
    default:
      styles = {
        background: 'bg-slate-800',
        animation: '',
        glow: '',
        scale: 'scale-100'
      };
  }

  console.log(`=== [STYLING_SYNC_END] Frame-ready styles generated ===`);
  return styles;
};

/**
 * CONTEXTUAL IDENTITY GREETINGS
 * Injects user-defined assistant name and adopts a sophisticated, integrated tone.
 */
export const getContextualGreeting = (
  trigger: 'social' | 'wallet' | 'data' | 'achievement' | undefined, 
  assistantName: string = "Friend"
): string => {
  console.log(`=== [GREETING_LOGIC_START] Contextualizing for: ${trigger || 'general'} ===`);
  
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  const greetings = {
    social: `Interface established. I'm ${assistantName}. Ready to analyze your network connectivity and trust score distributions?`,
    wallet: `Ledger synchronized. ${assistantName} active. Your rewards represent a direct feedback loop of your platform utility—shall we review?`,
    data: `Connection verified. I'm ${assistantName}. We are currently creating a virtuous cycle through your data integrations.`,
    achievement: `Exceptional progress logged. ${assistantName} is here to acknowledge your growing competence within the ecosystem.`,
    default: `Good ${timeOfDay}. I'm ${assistantName}. My systems are integrated and ready for collaboration. What are we optimizing?`
  };

  const finalGreeting = greetings[trigger as keyof typeof greetings] || greetings.default;
  
  console.log(`=== [GREETING_LOGIC_END] Dispatched Identity: ${assistantName} ===`);
  return finalGreeting;
};