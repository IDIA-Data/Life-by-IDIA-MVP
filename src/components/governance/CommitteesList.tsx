import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HeartHandshake, Scale } from "lucide-react";

const COMMITTEES = [
  {
    icon: HeartHandshake,
    name: "Sociorelational Committee",
    mandate: "Funds community health, inclusion, and context-collapse mitigation across the decentralized network.",
    accent: "text-rose-600 bg-rose-50",
  },
  {
    icon: Scale,
    name: "Legal Defense Council",
    mandate: "Funds legal activism protecting the DUNA and Delaware wrapper structures from jurisdictional friction.",
    accent: "text-indigo-600 bg-indigo-50",
  },
];

const CommitteesList: React.FC = () => (
  <div className="space-y-3">
    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
      Specialized Committees
    </h3>
    {COMMITTEES.map((c) => {
      const Icon = c.icon;
      return (
        <Card key={c.name} className="rounded-3xl border-teal-50 shadow-sm">
          <CardContent className="p-4 flex gap-3 items-start">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${c.accent}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-black">{c.name}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{c.mandate}</p>
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
);

export default CommitteesList;
