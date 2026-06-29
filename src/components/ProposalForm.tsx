
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { eventTracker } from '@/utils/EventTracker';

interface ProposalFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ProposalForm = ({ onClose, onSuccess }: ProposalFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [impact, setImpact] = useState('Medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Track form interaction through synapse
    eventTracker.trackVotingAction({
      vote_type: 'proposal',
      category: category || 'general',
      engagement_seconds: 30,
      research_actions: ['form_submission'],
      frequency_score: 1
    });
    
    if (!title.trim() || !description.trim() || !category) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    console.log("[PROPOSAL_SUBMIT][FORM_DISPATCH][START] Form submission initiated.");

    try {

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      // Create the proposal - this will automatically trigger synapse via database trigger
      const { data: proposal, error: insertError } = await supabase
        .from('user_proposals')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category: category,
          suggested_impact: impact
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Track successful proposal creation
      eventTracker.trackVotingAction({
        vote_type: 'proposal',
        category: category,
        engagement_seconds: 60,
        research_actions: ['proposal_created'],
        frequency_score: 2
      });

      // Call AI validation function via Supabase SDK (uses live publishable key + session)
      console.log("[PROPOSAL_FORM][VALIDATION_SUBMIT][START] Invoking edge engine for proposal checking...");
      const { data: validationResult, error: validationError } = await supabase.functions.invoke(
        'validate-proposal',
        {
          body: {
            proposalId: proposal.id,
            title: title.trim(),
            description: description.trim(),
            category,
          },
        }
      );

      // Track AI validation attempt
      eventTracker.trackAIInteraction({
        interaction_type: 'text',
        conversation_length: 1,
        topics: ['governance', 'proposal_validation'],
        satisfaction: 5,
        feature: 'proposal_validation'
      });

      if (validationError) {
        console.error("[PROPOSAL_FORM][VALIDATION_SUBMIT][END:FAIL]", validationError.message);
        throw new Error(validationError.message || 'Failed to validate proposal');
      }
      console.log("[PROPOSAL_FORM][VALIDATION_SUBMIT][END:OK] Proposal structural constraints verified.");


      // Track validation result
      eventTracker.trackVotingAction({
        vote_type: 'proposal',
        category: 'validation_completed',
        engagement_seconds: 120,
        research_actions: ['ai_validation'],
        frequency_score: 2
      });

      console.log("[PROPOSAL_SUBMIT][FORM_DISPATCH][SUCCESS] Proposal pipeline completed.");
      toast({
        title: "Proposal submitted!",
        description: `Your proposal has been ${validationResult.status}. ${validationResult.feedback}`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("[PROPOSAL_SUBMIT][FORM_DISPATCH][FATAL_FAIL]", error?.message ?? error);

      
      // Track error through synapse
      eventTracker.trackVotingAction({
        vote_type: 'proposal',
        category: 'error_tracking',
        engagement_seconds: 10,
        research_actions: ['submission_failed'],
        frequency_score: 0
      });
      
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit proposal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Submit a Governance Proposal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title"
              maxLength={100}
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Category *</label>
            <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data-policy">Data Policy</SelectItem>
                <SelectItem value="rewards">Rewards & Incentives</SelectItem>
                <SelectItem value="platform">Platform Features</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
                <SelectItem value="security">Security & Privacy</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expected Impact</label>
            <Select value={impact} onValueChange={setImpact} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low Impact</SelectItem>
                <SelectItem value="Medium">Medium Impact</SelectItem>
                <SelectItem value="High">High Impact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal in detail..."
              rows={6}
              maxLength={1000}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/1000 characters</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Proposal'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProposalForm;
