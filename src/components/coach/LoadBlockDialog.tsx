import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Layers, Loader2, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface LoadBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalWeeks: number;
  currentWeek: number;
  onLoad: (templateId: string, insertAtWeek: number) => void;
  isLoading?: boolean;
}

interface BlockTemplate {
  id: string;
  name: string;
  description: string | null;
  weekCount: number;
  created_at: string;
}

export function LoadBlockDialog({
  open,
  onOpenChange,
  totalWeeks,
  currentWeek,
  onLoad,
  isLoading,
}: LoadBlockDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [insertAtWeek, setInsertAtWeek] = useState(currentWeek);

  // Fetch block templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["block-templates", user?.id],
    queryFn: async (): Promise<BlockTemplate[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("program_plans")
        .select(
          `
          id,
          name,
          description,
          created_at,
          program_weeks(id)
        `,
        )
        .eq("coach_id", user.id)
        .eq("is_template", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        weekCount: Array.isArray(plan.program_weeks) ? plan.program_weeks.length : 0,
        created_at: plan.created_at,
      }));
    },
    enabled: open && !!user?.id,
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const payload: TablesUpdate<"program_plans"> = {
        deleted_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("program_plans").update(payload).eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-templates"] });
      toast.success("Template eliminato");
      setSelectedTemplateId(null);
    },
    onError: () => {
      toast.error("Errore nell'eliminazione del template");
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedTemplateId(null);
      setInsertAtWeek(currentWeek);
    }
    onOpenChange(isOpen);
  };

  const handleLoad = () => {
    if (selectedTemplateId) {
      onLoad(selectedTemplateId, insertAtWeek);
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Carica Blocco Template
          </DialogTitle>
          <DialogDescription>Inserisci un blocco salvato nel programma corrente</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca template..."
              className="pl-9"
            />
          </div>

          {/* Templates List */}
          <ScrollArea className="h-[200px] rounded-md border">
            {templatesLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Layers className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Nessun template trovato" : "Nessun template salvato"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border group",
                      selectedTemplateId === template.id
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-secondary border-transparent",
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-3xs">
                          {template.weekCount} settiman
                          {template.weekCount === 1 ? "a" : "e"}
                        </Badge>
                        {template.description && (
                          <span className="text-3xs text-muted-foreground truncate">
                            {template.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      aria-label="Elimina template"
                      disabled={deleteMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(template.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Insert Position */}
          {selectedTemplate && (
            <div className="space-y-2">
              <Label>Inserisci a partire dalla settimana</Label>
              <Select
                value={insertAtWeek.toString()}
                onValueChange={(v) => setInsertAtWeek(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalWeeks + 1 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i === totalWeeks ? `Aggiungi alla fine (S${i + 1}+)` : `Settimana ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-3xs text-muted-foreground">
                Le settimane esistenti da S{insertAtWeek + 1} saranno spostate in avanti
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleLoad} disabled={!selectedTemplateId || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Caricamento...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Carica Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
