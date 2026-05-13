
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Star, 
  Users, 
  Heart, 
  Award, 
  TrendingUp, 
  Search,
  Plus,
  Shield,
  Zap
} from 'lucide-react';

const SocialScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const trustScore = {
    current: 847,
    maxScore: 1000,
    rank: 'Excellent',
    percentile: 92
  };

  const trustCircles = [
    {
      id: 1,
      name: 'Close Friends',
      members: 12,
      avgTrustScore: 832,
      color: 'from-pink-500 to-rose-500'
    },
    {
      id: 2,
      name: 'Work Colleagues',
      members: 8,
      avgTrustScore: 789,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 3,
      name: 'Neighborhood',
      members: 15,
      avgTrustScore: 756,
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const friends = [
    {
      id: 1,
      name: 'Sarah Chen',
      trustScore: 892,
      avatar: '👩‍💼',
      mutual: 5,
      endorsements: 23,
      lastActivity: '2 hours ago'
    },
    {
      id: 2,
      name: 'Marcus Johnson',
      trustScore: 834,
      avatar: '👨‍🔬',
      mutual: 3,
      endorsements: 18,
      lastActivity: '1 day ago'
    },
    {
      id: 3,
      name: 'Elena Rodriguez',
      trustScore: 798,
      avatar: '👩‍🎨',
      mutual: 7,
      endorsements: 31,
      lastActivity: '3 hours ago'
    },
    {
      id: 4,
      name: 'David Kim',
      trustScore: 865,
      avatar: '👨‍💻',
      mutual: 2,
      endorsements: 15,
      lastActivity: '5 hours ago'
    }
  ];

  const recentGoodDeeds = [
    {
      id: 1,
      title: 'Helped elderly neighbor with groceries',
      points: '+15',
      status: 'verified',
      date: '2 days ago'
    },
    {
      id: 2,
      title: 'Volunteered at local food bank',
      points: '+25',
      status: 'verified',
      date: '1 week ago'
    },
    {
      id: 3,
      title: 'Returned lost wallet to owner',
      points: '+20',
      status: 'pending',
      date: '3 days ago'
    }
  ];

  const getTrustScoreColor = (score: number) => {
    if (score >= 850) return 'text-green-600 bg-green-100';
    if (score >= 750) return 'text-blue-600 bg-blue-100';
    if (score >= 650) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreRank = (score: number) => {
    if (score >= 850) return 'Excellent';
    if (score >= 750) return 'Very Good';
    if (score >= 650) return 'Good';
    return 'Fair';
  };

  return (
    <div className="p-4 space-y-6">
      {/* Trust Score Overview */}
      <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 mb-1">IDIA Trust Score™</p>
              <p className="text-4xl font-bold">{trustScore.current}</p>
              <p className="text-sm text-purple-100">
                {trustScore.rank} • Top {100 - trustScore.percentile}%
              </p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${(trustScore.current / trustScore.maxScore) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button className="py-6 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
          <div className="text-center">
            <Plus className="w-6 h-6 mx-auto mb-1" />
            <span className="block text-sm font-semibold">Add Friend</span>
          </div>
        </Button>
        <Button variant="outline" className="py-6 border-2 hover:bg-gray-50">
          <div className="text-center">
            <Zap className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
            <span className="block text-sm font-semibold text-gray-700">Submit Good Deed</span>
          </div>
        </Button>
      </div>

      {/* Trust Circles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Trust Circles</h2>
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>
        <div className="space-y-3">
          {trustCircles.map((circle) => (
            <Card key={circle.id}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${circle.color} rounded-full flex items-center justify-center`}>
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{circle.name}</h3>
                    <p className="text-sm text-gray-600">{circle.members} members</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">Avg Score</p>
                    <Badge className={getTrustScoreColor(circle.avgTrustScore)}>
                      {circle.avgTrustScore}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Friends List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Friends</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-40"
            />
          </div>
        </div>
        <div className="space-y-3">
          {friends.map((friend) => (
            <Card key={friend.id}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{friend.avatar}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{friend.name}</h3>
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <span>{friend.mutual} mutual</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Heart className="w-3 h-3 text-red-500" />
                        <span>{friend.endorsements}</span>
                      </span>
                      <span>•</span>
                      <span>{friend.lastActivity}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getTrustScoreColor(friend.trustScore)}>
                      {friend.trustScore}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {getScoreRank(friend.trustScore)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Good Deeds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <span>Recent Good Deeds</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentGoodDeeds.map((deed) => (
            <div key={deed.id} className="flex items-start space-x-3 py-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                deed.status === 'verified' ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {deed.status === 'verified' ? (
                  <Star className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-yellow-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{deed.title}</p>
                <p className="text-sm text-gray-600">{deed.date}</p>
              </div>
              <div className="text-right">
                <Badge variant={deed.status === 'verified' ? 'default' : 'secondary'}>
                  {deed.status === 'verified' ? 'Verified' : 'Pending'}
                </Badge>
                <p className="text-sm font-medium text-green-600 mt-1">{deed.points}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialScreen;
