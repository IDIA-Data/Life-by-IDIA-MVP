
import { X, MessageCircle, Send, Mic, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Message, FriendState } from './types';
import { getOrbStyling } from './orbUtils';

interface ExpandedChatProps {
  messages: Message[];
  inputValue: string;
  friendState: FriendState;
  isListening: boolean;
  isSyllableBlinking?: boolean;
  isVoiceMode: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onVoiceToggle: () => void;
  onCollapse: () => void;
  onClose: () => void;
  onSpeakText: (text: string) => void;
}

const ExpandedChat = ({
  messages,
  inputValue,
  friendState,
  isListening,
  isSyllableBlinking,
  isVoiceMode,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onVoiceToggle,
  onCollapse,
  onClose,
  onSpeakText
}: ExpandedChatProps) => {
  const orbStyle = getOrbStyling(friendState, isSyllableBlinking);

  return (
    <Card className="w-80 h-96 shadow-xl animate-scale-in">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Mini mystical state orb in header - clickable for voice */}
            <div 
              className={`relative w-6 h-6 rounded-full ${orbStyle.background} ${orbStyle.animation} ${orbStyle.scale} transition-all duration-500 flex items-center justify-center cursor-pointer hover:scale-110 border border-white/30`}
              onClick={onVoiceToggle}
            >
              {/* Mini mystical layers */}
              <div className="absolute inset-1 rounded-full bg-white/15 blur-[0.5px]"></div>
              <div className="w-2 h-2 rounded-full bg-white/30 backdrop-blur-sm"></div>
            </div>
            <span className="font-semibold">IDIA Friend</span>
            <span className="text-xs opacity-75 capitalize">({friendState})</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapse}
              className="text-white hover:bg-white/20 p-1"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-80">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  message.isUser
                    ? 'bg-teal-500 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-900 rounded-bl-none'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          
          {/* Thinking indicator */}
          {friendState === 'thinking' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 rounded-lg rounded-bl-none p-3 text-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            {!isVoiceMode && (
              <>
                <Input
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyPress={onKeyPress}
                  placeholder="Ask me anything about IDIA..."
                  className="flex-1"
                  disabled={friendState === 'thinking'}
                />
                <Button
                  onClick={onSendMessage}
                  size="sm"
                  className="bg-teal-500 hover:bg-teal-600"
                  disabled={friendState === 'thinking'}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {isVoiceMode && (
              <div className="flex-1 flex items-center justify-center py-2">
                <span className="text-sm text-muted-foreground">
                  {isListening ? '🎙️ Listening...' : friendState === 'thinking' ? '🤔 Processing...' : friendState === 'speaking' ? '🗣️ Speaking...' : '🎤 Voice mode active'}
                </span>
              </div>
            )}
            
            <Button
              onClick={onVoiceToggle}
              size="sm"
              variant={isVoiceMode ? "destructive" : "outline"}
              className={`${isListening ? 'bg-purple-100 border-purple-300' : ''}`}
            >
              <Mic className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpandedChat;
