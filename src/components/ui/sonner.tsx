import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { notify } from "@/lib/notify";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={3000}
      offset={`calc(3.5rem + env(safe-area-inset-top) + 0.5rem)`}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:text-[0.7rem] group-[.toaster]:px-3 group-[.toaster]:py-2 group-[.toaster]:max-w-[260px] group-[.toaster]:min-h-0 group-[.toaster]:rounded-md",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[0.65rem]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-[0.65rem]",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-[0.65rem]",
        },
      }}
      {...props}
    />
  );
};

/**
 * Drop-in replacement for sonner's `toast` that ALSO records to the
 * centralized notification history (bell dropdown).
 *
 * Supports the most common sonner call shapes:
 *   toast("message")
 *   toast("message", { description })
 *   toast.success("message", { description })
 *   toast.error / toast.warning / toast.info
 */
type ToastOpts = { description?: string } & Record<string, unknown>;

function callDefault(message: string, opts?: ToastOpts) {
  notify.info(message, { description: opts?.description as string | undefined });
}

const toast = Object.assign(callDefault, {
  success: (message: string, opts?: ToastOpts) =>
    notify.success(message, { description: opts?.description as string | undefined }),
  error: (message: string, opts?: ToastOpts) =>
    notify.error(message, { description: opts?.description as string | undefined }),
  warning: (message: string, opts?: ToastOpts) =>
    notify.warning(message, { description: opts?.description as string | undefined }),
  info: (message: string, opts?: ToastOpts) =>
    notify.info(message, { description: opts?.description as string | undefined }),
  message: (message: string, opts?: ToastOpts) =>
    notify.info(message, { description: opts?.description as string | undefined }),
});

export { Toaster, toast };
