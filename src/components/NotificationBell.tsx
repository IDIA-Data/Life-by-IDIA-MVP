import { useState } from "react";
import { Bell, Check, Trash2, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  notificationStore,
  useNotifications,
  useUnreadCount,
  type NotificationItem,
} from "@/stores/notificationStore";
import { useProfile } from "@/hooks/useProfile";

const LEVEL_ICON: Record<NotificationItem["level"], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const LEVEL_TONE: Record<NotificationItem["level"], string> = {
  info: "text-muted-foreground",
  success: "text-primary",
  warning: "text-amber-500",
  error: "text-destructive",
};

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const NotificationBell = () => {
  const items = useNotifications();
  const unread = useUnreadCount();
  const { preferences } = useProfile();
  const alertsEnabled = preferences?.in_app_alerts !== false;
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const DetailIcon = selected ? LEVEL_ICON[selected.level] : Info;

  return (
    <>
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (open && unread > 0) notificationStore.markAllRead();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={`Notifications${unread && alertsEnabled ? `, ${unread} unread` : ""}`}
          >
            <Bell className="w-5 h-5" />
            {alertsEnabled && unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[0.55rem] font-semibold flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 p-0 max-h-[60vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[0.65rem] text-muted-foreground"
                  onClick={() => notificationStore.markAllRead()}
                >
                  <Check className="w-3 h-3 mr-1" /> Mark read
                </Button>
              )}
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[0.65rem] text-muted-foreground"
                  onClick={() => notificationStore.clearAll()}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const Icon = LEVEL_ICON[item.level];
                  return (
                    <li
                      key={item.id}
                      className="px-3 py-2 hover:bg-muted/40 cursor-pointer active:scale-[0.99] transition"
                      onClick={() => {
                        setSelected(item);
                        setPopoverOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${LEVEL_TONE[item.level]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-foreground truncate">
                              {item.title}
                            </span>
                            <span className="text-[0.6rem] text-muted-foreground shrink-0">
                              {formatRelative(item.timestamp)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[0.65rem] text-muted-foreground line-clamp-2 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-foreground">
              <DetailIcon
                className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? LEVEL_TONE[selected.level] : ""}`}
              />
              <span className="break-words">{selected?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {selected ? new Date(selected.timestamp).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto text-sm text-foreground whitespace-pre-wrap break-words">
            {selected?.description || (
              <span className="text-muted-foreground italic">No additional details.</span>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {selected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  notificationStore.remove(selected.id);
                  setSelected(null);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            )}
            <Button size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
