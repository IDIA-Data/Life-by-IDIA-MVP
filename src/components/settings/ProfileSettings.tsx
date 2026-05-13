import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Plus, CalendarIcon, Lock, Unlock, AlertTriangle, Fingerprint, RefreshCw, Upload, Shield, User, MapPin, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { useSecureProfile, SecurePII } from '@/hooks/useSecureProfile';
import { useWallet } from '@/hooks/useWallet';
import { useSovereignWallet } from '@/hooks/useSovereignWallet';
import { useEnhancedProfile } from '@/hooks/useEnhancedProfile';
import { US_STATES, formatPhoneNumber } from '@/utils/usAddressValidation';
import { useToast } from '@/hooks/use-toast';

const profileSchema = z.object({
  display_name: z.string().optional(),
  ai_assistant_name: z.string().optional(),
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  middle_name: z.string().optional(),
  suffix: z.string().optional(),
  date_of_birth: z.date({ required_error: 'Date of birth is required' }),
  gender: z.string().optional(),
  phone_number: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Phone must be in (XXX) XXX-XXXX format'),
  email: z.string().email('Invalid email address'),
  street1: z.string().min(1, 'Street address is required').max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1, 'City is required').max(50),
  state: z.string().min(2, 'State is required'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be XXXXX or XXXXX-XXXX'),
  occupation: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const INTEREST_OPTIONS = [
  'Fitness', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Meditation',
  'Nutrition', 'Weight Loss', 'Strength Training', 'Cardio',
  'Mental Health', 'Sleep', 'Stress Management', 'Hiking',
  'Sports', 'Dancing', 'Rock Climbing', 'Martial Arts',
  'Technology', 'Finance', 'Web3', 'Art', 'Music', 'Reading'
];

const HEALTH_GOAL_OPTIONS = [
  'Weight Loss', 'Weight Gain', 'Muscle Building', 'Endurance',
  'Flexibility', 'Balance', 'Heart Health', 'Blood Pressure',
  'Cholesterol', 'Diabetes Management', 'Mental Wellbeing',
  'Better Sleep', 'Stress Reduction', 'Recovery', 'Peak Performance'
];

const ACTIVITY_PREFERENCE_OPTIONS = [
  'Morning Workouts', 'Evening Workouts', 'Indoor Activities', 'Outdoor Activities',
  'Group Activities', 'Solo Activities', 'High Intensity', 'Low Intensity',
  'Short Sessions', 'Long Sessions', 'Daily Movement', 'Weekend Warrior'
];

export function ProfileSettings() {
  const { profile: baseProfile, loading: profileLoading, updating, updateProfile } = useProfile();
  const { profile: enhancedProfile, uploadAvatar } = useEnhancedProfile();
  const { pii, loading: piiLoading, saving: piiSaving, save: savePII } = useSecureProfile();
  const { hasWallet, getSeedPhrase } = useWallet();
  const { globalWalletAddress } = useSovereignWallet(enhancedProfile?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const profile = baseProfile;

  const [locked, setLocked] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [newInterest, setNewInterest] = useState('');
  const [newHealthGoal, setNewHealthGoal] = useState('');
  const [newActivityPref, setNewActivityPref] = useState('');

  const [interests, setInterests] = useState<string[]>([]);
  const [healthGoals, setHealthGoals] = useState<string[]>([]);
  const [activityPreferences, setActivityPreferences] = useState<string[]>([]);

  // Legacy user: cloud identity exists but local Secure Enclave is empty
  const isLegacyMissingHardware = !!globalWalletAddress && !hasWallet;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema)
  });

  const phoneValue = watch('phone_number') || '';
  const dobValue = watch('date_of_birth');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return;
    const formatted = formatPhoneNumber(e.target.value);
    setValue('phone_number', formatted, { shouldValidate: true, shouldDirty: true });
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !locked) {
      setAvatarPreview(URL.createObjectURL(file));
      uploadAvatar(file);
      toast({ title: "Avatar Uploaded", description: "Your profile picture has been updated." });
    }
  };

  // Hydrate form from Secure Enclave PII + Supabase profile
  useEffect(() => {
    if (pii) {
      setValue('first_name', pii.first_name || '');
      setValue('last_name', pii.last_name || '');
      setValue('email', pii.email || '');
      if (pii.phone) {
        const digits = pii.phone.replace(/\D/g, '');
        if (digits.length === 10) {
          setValue('phone_number', `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
        } else {
          setValue('phone_number', pii.phone);
        }
      }
    }
  }, [pii, setValue]);

  useEffect(() => {
    if (profile) {
      setValue('display_name', profile.display_name || '');
      setValue('ai_assistant_name', profile.ai_assistant_name || '');
      setValue('middle_name', profile.middle_name || '');
      setValue('suffix', profile.suffix || '');
      if (profile.date_of_birth) {
        const parsed = new Date(profile.date_of_birth);
        if (isValid(parsed)) setValue('date_of_birth', parsed);
      }
      setValue('gender', profile.gender || '');
      setValue('street1', profile.full_legal_address?.street1 || '');
      setValue('street2', profile.full_legal_address?.street2 || '');
      setValue('city', profile.full_legal_address?.city || '');
      setValue('state', profile.full_legal_address?.state || '');
      setValue('zip', profile.full_legal_address?.zip || '');
      setValue('occupation', profile.occupation || '');
      setValue('bio', profile.bio || '');
      setInterests(profile.interests || []);
      setHealthGoals(profile.health_goals || []);
      setActivityPreferences(profile.activity_preferences || []);
    }
  }, [profile, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    const { street1, street2, city, state, zip, phone_number, date_of_birth, first_name, last_name, email: formEmail, display_name, ai_assistant_name, ...rest } = data;

    // 1. Save PII fields to Secure Enclave (never to backend plaintext)
    const digits = phone_number.replace(/\D/g, '');
    const enclavePhone = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    
    const piiData: SecurePII = {
      first_name,
      last_name,
      email: formEmail,
      phone: enclavePhone,
    };
    await savePII(piiData); 

    // 2. Save non-PII fields to Supabase profile
    await updateProfile({
      ...rest,
      display_name,
      ai_assistant_name,
      date_of_birth: format(date_of_birth, 'yyyy-MM-dd'),
      phone_number: undefined, // NEVER send phone to backend
      full_legal_address: { street1, street2: street2 || '', city, state, zip },
      interests,
      health_goals: healthGoals,
      activity_preferences: activityPreferences,
    } as any);

    toast({
      title: 'Profile Saved',
      description: 'PII updated in your Secure Enclave. Cloud preferences saved.',
    });

    setLocked(true);
  };

  const handleViewRecovery = async () => {
    console.log("🔐 [START: Recovery Phrase Reveal] Prompting for identity verification.");
    try {
      const phrase = await getSeedPhrase();
      if (phrase) {
        console.log("🔐 [PROCESS] Phrase retrieved from Secure Enclave.");
        navigate(`/recovery-phrase?mode=view`);
      } else {
        toast({ title: "No vault found", description: "No recovery phrase available on this device.", variant: "destructive" });
      }
    } catch (error) {
      console.error("🚨 [ERROR] Reveal failed:", error);
      toast({ title: "Verification failed", description: "Unable to access Secure Enclave.", variant: "destructive" });
    }
  };

  const handleRestoreLegacy = async () => {
    console.log("🔄 [START: Legacy Restore] Initiating hardware re-provisioning.");
    window.dispatchEvent(new CustomEvent("open-wallet-import", { detail: { reason: "legacy-restore" } }));
    toast({ title: "Restore Legacy Vault", description: "Open the Wallet tab to import your 12-word phrase." });
  };

  const addItem = (item: string, setter: React.Dispatch<React.SetStateAction<string[]>>, resetValue: React.Dispatch<React.SetStateAction<string>>) => {
    if (item.trim() && !locked) {
      setter(prev => [...prev, item.trim()]);
      resetValue('');
    }
  };

  const removeItem = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!locked) setter(prev => prev.filter((_, i) => i !== index));
  };

  const isLoading = profileLoading || piiLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-muted rounded-lg w-full"></div>
        <div className="h-64 bg-muted rounded-xl w-full"></div>
        <div className="h-64 bg-muted rounded-xl w-full"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">
      
      {/* Dynamic Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 backdrop-blur-md py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          {locked ? (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
              <Unlock className="w-4 h-4 text-green-500" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{locked ? 'Vault Locked' : 'Editing Profile'}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {locked ? 'Tap unlock to edit values' : 'Changes save to Secure Enclave'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLocked(true)}>
              Cancel
            </Button>
          )}
          <Button
            type={locked ? "button" : "submit"}
            variant={locked ? "secondary" : "default"}
            size="sm"
            onClick={locked ? () => setLocked(false) : undefined}
            disabled={updating || piiSaving}
            className={!locked ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {locked ? 'Unlock' : (updating || piiSaving ? 'Saving...' : 'Save Changes')}
          </Button>
        </div>
      </div>

      {/* Legal Notice */}
      {!locked && (
        <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">KYC / AML Notice:</strong> Providing fraudulent information is a violation of IDIA Protocol Terms. False data will result in immediate account termination and potential referral to authorities.
          </p>
        </div>
      )}

      {/* CARD 1: Public Identity */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Public Identity</CardTitle>
          <CardDescription>How you appear in the IDIA ecosystem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-border/50">
            <Avatar className="w-16 h-16 border border-border">
              <AvatarImage src={avatarPreview || profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/5 text-primary text-lg">
                {pii?.first_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={locked || updating}
              />
              <Label htmlFor="avatar-upload" className={locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}>
                <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                  <Upload className="w-3 h-3 mr-2" /> Change Avatar
                </div>
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" {...register('display_name')} placeholder="Nickname" disabled={locked} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_assistant_name">AI Assistant Name</Label>
              <Input id="ai_assistant_name" {...register('ai_assistant_name')} placeholder="Friend" disabled={locked} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bio">Personal Bio</Label>
              <Textarea id="bio" {...register('bio')} placeholder="Tell us about yourself..." rows={3} disabled={locked} />
              {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: Secure Legal Identity (PII) */}
      <Card className="border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.03)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Shield className="w-4 h-4" /> Secure Legal Identity
          </CardTitle>
          <CardDescription>Stored exclusively in your device's Secure Enclave</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">Legal First Name *</Label>
            <Input id="first_name" {...register('first_name')} disabled={locked} />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Legal Last Name *</Label>
            <Input id="last_name" {...register('last_name')} disabled={locked} />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="middle_name">Middle Name</Label>
            <Input id="middle_name" {...register('middle_name')} placeholder="Optional" disabled={locked} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suffix">Suffix</Label>
            <Input id="suffix" {...register('suffix')} placeholder="Jr., Sr., III" disabled={locked} />
          </div>

          <div className="space-y-2">
            <Label>Date of Birth *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={locked}
                  className={cn("w-full justify-start text-left font-normal", !dobValue && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dobValue ? format(dobValue, "MM/dd/yyyy") : <span>Select Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dobValue}
                  onSelect={(date) => date && setValue('date_of_birth', date, { shouldValidate: true, shouldDirty: true })}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                />
              </PopoverContent>
            </Popover>
            {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select 
              onValueChange={(value) => setValue('gender', value, { shouldDirty: true })} 
              value={watch('gender') || ''} 
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Secure Email *</Label>
            <Input id="email" type="email" {...register('email')} disabled={locked} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Secure Phone *</Label>
            <Input
              id="phone_number"
              type="tel"
              value={phoneValue}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              maxLength={14}
              disabled={locked}
            />
            {errors.phone_number && <p className="text-xs text-destructive">{errors.phone_number.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* CARD 3: Mailing Address */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> Legal Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street1">Street Address</Label>
            <Input id="street1" {...register('street1')} placeholder="123 Main St" disabled={locked} />
            {errors.street1 && <p className="text-xs text-destructive">{errors.street1.message}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street2">Apt, Suite, Unit</Label>
            <Input id="street2" {...register('street2')} placeholder="Optional" disabled={locked} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} disabled={locked} />
            {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select 
              onValueChange={(value) => setValue('state', value, { shouldValidate: true, shouldDirty: true })} 
              value={watch('state') || ''} 
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {US_STATES.map(s => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="zip">ZIP Code</Label>
            <Input id="zip" {...register('zip')} placeholder="12345" maxLength={10} disabled={locked} />
            {errors.zip && <p className="text-xs text-destructive">{errors.zip.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* CARD 4: Psychometrics & Preferences */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Psychometrics</CardTitle>
          <CardDescription>Train your Sovereign AI model</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="space-y-3">
            <Label>Core Interests</Label>
            <div className="flex gap-2">
              <Select onValueChange={setNewInterest} value={newInterest} disabled={locked}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add an interest" />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_OPTIONS.filter(opt => !interests.includes(opt)).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => addItem(newInterest, setInterests, setNewInterest)} disabled={!newInterest || locked}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((item, idx) => (
                <Badge key={idx} variant="secondary" className="px-2 py-1 text-xs">
                  {item}
                  {!locked && <X className="w-3 h-3 ml-2 cursor-pointer hover:text-destructive" onClick={() => removeItem(idx, setInterests)} />}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Health Goals</Label>
            <div className="flex gap-2">
              <Select onValueChange={setNewHealthGoal} value={newHealthGoal} disabled={locked}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add a goal" />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_GOAL_OPTIONS.filter(opt => !healthGoals.includes(opt)).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => addItem(newHealthGoal, setHealthGoals, setNewHealthGoal)} disabled={!newHealthGoal || locked}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {healthGoals.map((item, idx) => (
                <Badge key={idx} variant="secondary" className="px-2 py-1 text-xs">
                  {item}
                  {!locked && <X className="w-3 h-3 ml-2 cursor-pointer hover:text-destructive" onClick={() => removeItem(idx, setHealthGoals)} />}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Activity Preferences</Label>
            <div className="flex gap-2">
              <Select onValueChange={setNewActivityPref} value={newActivityPref} disabled={locked}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add a preference" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_PREFERENCE_OPTIONS.filter(opt => !activityPreferences.includes(opt)).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => addItem(newActivityPref, setActivityPreferences, setNewActivityPref)} disabled={!newActivityPref || locked}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activityPreferences.map((item, idx) => (
                <Badge key={idx} variant="secondary" className="px-2 py-1 text-xs">
                  {item}
                  {!locked && <X className="w-3 h-3 ml-2 cursor-pointer hover:text-destructive" onClick={() => removeItem(idx, setActivityPreferences)} />}
                </Badge>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* CARD 5: Sovereign Vault Security */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Vault Security</CardTitle>
          <CardDescription>Hardware-level cryptographic settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Hardware Status</span>
              <Badge variant={hasWallet ? "default" : "destructive"} className="text-[10px] uppercase tracking-wider">
                {hasWallet ? "Enclave Secured" : "Hardware Missing"}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Global IDIA Address</span>
              <span className="text-xs font-mono text-foreground break-all">
                {globalWalletAddress || "No global address found in network."}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2">
            {hasWallet ? (
              <Button type="button" variant="outline" className="w-full justify-start h-10" onClick={handleViewRecovery}>
                <Fingerprint className="w-4 h-4 mr-3" /> View Recovery Phrase
              </Button>
            ) : null}

            {isLegacyMissingHardware && (
              <Button type="button" variant="outline" className="w-full justify-start h-10 border-amber-500/50 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={handleRestoreLegacy}>
                <RefreshCw className="w-4 h-4 mr-3" /> Restore Legacy Vault via Seed
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-2">
            Your PII (Personally Identifiable Information) and wallet keys are secured exclusively in your device's Secure Enclave. <strong>IDIA Data Inc. cannot recover your identity if you lose your device without a physical backup.</strong>
          </p>
        </CardContent>
      </Card>

    </form>
  );
}