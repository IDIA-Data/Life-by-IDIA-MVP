import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Friend {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  accepted_at: string | null;
  friend_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface TrustCircle {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  member_count?: number;
}

export interface GoodDeed {
  id: string;
  user_id: string;
  title: string;
  description: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  evidence_url: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
}

export interface SocialHealthMetrics {
  user_id: string;
  reciprocity_score: number;
  network_vitality_score: number;
  network_size: number;
  last_calculated: string;
}

export type ActivityType = 'friend' | 'circle' | 'deed';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  status?: string;
  timestamp: string;
}

export const useSocialGraph = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [trustCircles, setTrustCircles] = useState<TrustCircle[]>([]);
  const [goodDeeds, setGoodDeeds] = useState<GoodDeed[]>([]);
  const [socialMetrics, setSocialMetrics] = useState<SocialHealthMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load real data from all four sources in parallel
      const [friendsRes, circlesRes, membersRes, deedsRes] = await Promise.all([
        (supabase as any)
          .from('friends')
          .select('*')
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('trust_circles')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('trust_circle_members')
          .select('circle_id')
          .eq('user_id', user.id),
        (supabase as any)
          .from('good_deeds')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const friendsData: Friend[] = (friendsRes.data || []) as Friend[];
      const circlesData: TrustCircle[] = (circlesRes.data || []) as TrustCircle[];
      const deedsData: GoodDeed[] = (deedsRes.data || []) as GoodDeed[];

      setFriends(friendsData);
      setTrustCircles(circlesData);
      setGoodDeeds(deedsData);

      // ---- Live metric calculations ----
      const acceptedFriends = friendsData.filter((f) => f.status === 'accepted');
      const networkSize = acceptedFriends.length;

      // Reciprocity: ratio of requests received vs sent that are now accepted (0-1)
      const sent = friendsData.filter((f) => f.user_id_1 === user.id).length;
      const received = friendsData.filter((f) => f.user_id_2 === user.id).length;
      const total = sent + received;
      const reciprocity = total === 0 ? 0 : Math.min(sent, received) / Math.max(sent, received, 1);

      // Network vitality: weighted blend of accepted friends, verified deeds, circle activity
      const verifiedDeeds = deedsData.filter((d) => d.verification_status === 'verified').length;
      const circleCount = circlesData.length + (membersRes.data?.length || 0);
      const vitalityRaw =
        Math.min(networkSize / 10, 1) * 0.5 +
        Math.min(verifiedDeeds / 5, 1) * 0.3 +
        Math.min(circleCount / 3, 1) * 0.2;

      setSocialMetrics({
        user_id: user.id,
        reciprocity_score: reciprocity,
        network_vitality_score: vitalityRaw,
        network_size: networkSize,
        last_calculated: new Date().toISOString(),
      });

      // ---- Live activity feed (merged + sorted desc) ----
      const activity: ActivityItem[] = [
        ...friendsData.slice(0, 10).map<ActivityItem>((f) => ({
          id: `friend-${f.id}`,
          type: 'friend',
          title: f.status === 'accepted' ? 'New friend connection' : 'Friend request',
          subtitle: f.status === 'pending' ? 'Awaiting response' : undefined,
          status: f.status,
          timestamp: f.accepted_at || f.created_at,
        })),
        ...circlesData.slice(0, 10).map<ActivityItem>((c) => ({
          id: `circle-${c.id}`,
          type: 'circle',
          title: `Trust circle "${c.name}" created`,
          timestamp: c.created_at,
        })),
        ...deedsData.slice(0, 10).map<ActivityItem>((d) => ({
          id: `deed-${d.id}`,
          type: 'deed',
          title: d.title,
          subtitle: 'Good deed',
          status: d.verification_status,
          timestamp: d.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (_targetUserId: string) => {
    toast({
      title: 'Coming Soon',
      description: 'Friend requests will be available when social features are fully implemented',
    });
  };

  const acceptFriendRequest = async (_friendshipId: string) => {
    toast({
      title: 'Coming Soon',
      description: 'Friend request management will be available when social features are fully implemented',
    });
  };

  const submitGoodDeed = async (_title: string, _description: string, _evidenceFile?: File) => {
    toast({
      title: 'Coming Soon',
      description: 'Good deed submissions will be available when social features are fully implemented',
    });
  };

  const createTrustCircle = async (_name: string, _memberIds: string[] = []) => {
    toast({
      title: 'Coming Soon',
      description: 'Trust circles will be available when social features are fully implemented',
    });
  };

  return {
    friends,
    trustCircles,
    goodDeeds,
    socialMetrics,
    recentActivity,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    submitGoodDeed,
    createTrustCircle,
    reload: loadSocialData,
  };
};
