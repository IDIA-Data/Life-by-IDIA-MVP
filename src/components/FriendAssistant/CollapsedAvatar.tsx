import { FriendState } from './types';
import { getOrbStyling } from './orbUtils';

interface CollapsedAvatarProps {
  friendState: FriendState;
  isListening: boolean;
  isSyllableBlinking?: boolean;
  onOrbClick: () => void;
}

const CollapsedAvatar = ({
  friendState,
  isSyllableBlinking,
  onOrbClick,
}: CollapsedAvatarProps) => {
  const orbStyle = getOrbStyling(friendState, isSyllableBlinking);

  return (
    <button
      type="button"
      onClick={onOrbClick}
      aria-label="Open Friend assistant"
      className={`relative w-9 h-9 rounded-full ${orbStyle.background} ${orbStyle.animation} ${orbStyle.glow} ${orbStyle.scale} transition-all duration-500 flex items-center justify-center cursor-pointer hover:scale-110 border border-white/20`}
    >
      <div className="absolute inset-1.5 rounded-full bg-white/10 blur-[1px]">
        <div className="w-full h-full rounded-full bg-gradient-radial from-white/20 via-transparent to-transparent" />
      </div>
      <div className="absolute inset-2 rounded-full bg-white/5 blur-[2px]">
        <div className="w-full h-full rounded-full bg-gradient-radial from-white/15 via-transparent to-transparent" />
      </div>
      <div className="relative w-3.5 h-3.5 rounded-full bg-white/20 backdrop-blur-sm">
        <div className="absolute inset-0.5 rounded-full bg-white/10" />
      </div>
    </button>
  );
};

export default CollapsedAvatar;
