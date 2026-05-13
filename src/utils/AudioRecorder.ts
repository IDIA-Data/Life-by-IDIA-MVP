export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private onAudioData: (audioData: string) => void;
  private onVoiceActivity: (isActive: boolean) => void;
  private silenceTimer: NodeJS.Timeout | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    onAudioData: (audioData: string) => void,
    onVoiceActivity: (isActive: boolean) => void
  ) {
    this.onAudioData = onAudioData;
    this.onVoiceActivity = onVoiceActivity;
  }

  async start(): Promise<void> {
    try {
      console.log('Starting audio recording...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up voice activity detection
      this.setupVoiceActivityDetection();

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.onAudioData(base64);
        };
        reader.readAsDataURL(audioBlob);
        
        this.audioChunks = [];
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log('Recording started');

    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  private setupVoiceActivityDetection(): void {
    if (!this.stream) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    
    source.connect(this.analyser);
    this.analyser.fftSize = 256;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let consecutiveLowActivity = 0;
    const requiredSilence = 15; // ~1.5 seconds at 100ms intervals
    
    this.vadCheckInterval = setInterval(() => {
      this.analyser!.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const isVoiceActive = average > 30; // Threshold for voice activity
      
      if (isVoiceActive) {
        consecutiveLowActivity = 0;
        this.onVoiceActivity(true);
      } else {
        consecutiveLowActivity++;
        if (consecutiveLowActivity >= requiredSilence) {
          this.onVoiceActivity(false);
          this.stopRecording();
        }
      }
    }, 100);
  }

  stopRecording(): void {
    if (!this.isRecording) return;
    
    console.log('Stopping recording...');
    
    if (this.vadCheckInterval) {
      clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    this.isRecording = false;
  }

  stop(): void {
    this.stopRecording();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    console.log('Audio recorder stopped');
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}