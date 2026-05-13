import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Heart, Footprints, Moon, Zap, ExternalLink } from 'lucide-react';
import { useNativeHealth } from '@/hooks/useNativeHealth';
import { supabase as typedSupabase } from '@/integrations/supabase/client';
const supabase: any = typedSupabase;

interface AndroidHealthModalProps { isOpen: boolean; onClose: () => void; onComplete: () => void; existingConnection?: any; onDisconnect?: () => void; }

const AndroidHealthModal = ({ isOpen, onClose, onComplete, existingConnection, onDisconnect }: AndroidHealthModalProps) => {
  const { isAvailable, isSyncing, lastSync, requestPermissions, quickSync } = useNativeHealth();
  const [status, setStatus] = useState<'idle' | 'permissions-sent' | 'syncing' | 'connected' | 'error'>('idle');
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }: any) => { if (session?.user) setUserId(session.user.id); }); }, []);
  useEffect(() => { if (isOpen && !existingConnection) { setStatus('idle'); setErrorMsg(null); } }, [isOpen]);
  useEffect(() => { if (status === 'connected') { const t = setTimeout(onComplete, 2000); return () => clearTimeout(t); } }, [status, onComplete]);

  const handleRequest = useCallback(async () => {
    if (!userId || !isAvailable) { setErrorMsg(!isAvailable ? 'Health Connect not available. Install from Play Store.' : 'Please log in.'); return; }
    await requestPermissions();
    setStatus('permissions-sent');
  }, [userId, isAvailable, requestPermissions]);

  const handleSync = useCallback(async () => {
    setErrorMsg(null); setStatus('syncing');
    try {
      await supabase.from('data_connections').upsert({ user_id: userId, connection_type: 'health_connect', connection_name: 'Health Connect', is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,connection_type' });
      const r = await quickSync();
      if (r.success) setStatus('connected'); else { setErrorMsg(r.error || 'Could not read health data.'); setStatus('error'); }
    } catch (e: any) { setErrorMsg(e.message); setStatus('error'); }
  }, [userId, quickSync]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center space-x-2"><Activity className="w-6 h-6 text-green-600" /><span>{existingConnection ? 'Health Connect' : 'Connect Health Connect'}</span></DialogTitle></DialogHeader>
        <div className="space-y-4">
          {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-md"><p className="text-sm text-red-600">{errorMsg}</p></div>}

          {status === 'idle' && !existingConnection && (<>
            <p className="text-sm text-muted-foreground">Connect Health Connect to earn rewards for your fitness data.</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2"><Footprints className="w-4 h-4 text-blue-500" /><span>Steps</span></div>
              <div className="flex items-center space-x-2"><Heart className="w-4 h-4 text-red-500" /><span>Heart Rate</span></div>
              <div className="flex items-center space-x-2"><Activity className="w-4 h-4 text-green-500" /><span>Calories</span></div>
              <div className="flex items-center space-x-2"><Moon className="w-4 h-4 text-purple-500" /><span>Sleep</span></div>
            </div>
            <Button onClick={handleRequest} className="w-full" disabled={!userId || !isAvailable}><ExternalLink className="w-4 h-4 mr-2" />Open Health Connect Permissions</Button>
          </>)}

          {status === 'permissions-sent' && (
            <div className="space-y-4 text-center">
              <Activity className="w-10 h-10 text-teal-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Grant IDIA Life access in Health Connect, then tap below.</p>
              <Button onClick={handleSync} className="w-full">I've Granted Permissions — Sync Data</Button>
              <Button variant="outline" onClick={handleRequest} className="w-full">Open Health Connect Again</Button>
            </div>
          )}

          {status === 'syncing' && <div className="text-center py-6"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-sm text-muted-foreground">Syncing...</p></div>}

          {existingConnection && status === 'idle' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Zap className="w-6 h-6 text-green-600" /></div>
              <h3 className="font-medium text-green-800">Health Connect Connected</h3>
              <div className="flex space-x-3"><Button variant="outline" className="flex-1" onClick={onClose}>Close</Button><Button variant="destructive" className="flex-1" onClick={onDisconnect}>Disconnect</Button></div>
            </div>
          )}

          {status === 'error' && <Button onClick={() => { setStatus('idle'); setErrorMsg(null); }} variant="outline" className="w-full">Try Again</Button>}

          {status === 'connected' && lastSync?.data && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Zap className="w-6 h-6 text-green-600" /></div>
              <h3 className="font-medium text-green-800">Connected!</h3>
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3 text-center"><Footprints className="w-5 h-5 text-blue-500 mx-auto mb-1" /><div className="text-lg font-bold">{lastSync.data.steps?.toLocaleString() || '0'}</div><div className="text-xs text-muted-foreground">Steps</div></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><Heart className="w-5 h-5 text-red-500 mx-auto mb-1" /><div className="text-lg font-bold">{lastSync.data.heartRate || '--'}</div><div className="text-xs text-muted-foreground">BPM</div></CardContent></Card>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AndroidHealthModal;