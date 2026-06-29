import React from "react";
import { X, ScrollText, Download } from "lucide-react";

const MANUAL_PDF_URL = "/legal/IDIA_Data_DUNA_Welcome_Manual.pdf";

interface ManualViewerModalProps {
  open: boolean;
  onClose: () => void;
}

const ManualViewerModal: React.FC<ManualViewerModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl h-full max-h-[90vh] flex flex-col rounded-[2rem] border border-border bg-card shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-gradient-to-br from-[hsl(178,42%,32%)]/10 to-transparent flex items-center gap-3">
          <div className="p-2 bg-[hsl(178,42%,32%)]/10 rounded-lg">
            <ScrollText className="w-6 h-6 text-[hsl(178,42%,32%)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight">IDIA Data DUNA — Welcome Manual</h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
              Reference document for governance participants
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close manual"
            className="p-2 rounded-full hover:bg-muted/60 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/20">
          <div className="flex flex-col items-center gap-4 py-4 px-3 bg-muted/20">
            {Array.from({ length: 11 }, (_, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <img
                  key={n}
                  src={`/legal/duna-manual-pages/page-${n}.jpg`}
                  alt={`IDIA Data DUNA Welcome Manual — Page ${i + 1}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="w-full max-w-[760px] rounded-md shadow-md border border-border bg-white"
                />
              );
            })}
          </div>
          <div className="px-6 py-4 text-center bg-white border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              PDF not rendering? Open it directly:
            </p>
            <a
              href={MANUAL_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(178,42%,32%)] underline text-sm font-semibold"
            >
              Open Welcome Manual in new tab
            </a>
          </div>
          <div className="h-8" />
        </div>

        <div className="p-4 border-t border-border bg-background/60 flex items-center justify-between gap-3">
          <a
            href={MANUAL_PDF_URL}
            download
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
          >
            <Download size={14} />
            Download PDF
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest bg-[hsl(178,42%,32%)] text-white hover:bg-[hsl(178,42%,25%)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualViewerModal;
