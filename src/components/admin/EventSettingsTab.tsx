import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUp, Loader2, Save, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { optimizeImage } from "@/lib/optimizeImage";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;


interface EventSettingsTabProps {
  onChange?: () => void;
}

const EventSettingsTab = ({ onChange }: EventSettingsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [capacity, setCapacity] = useState("100");
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("event_settings")
      .select("capacity, event_title, event_info, poster_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCapacity(String(data.capacity ?? 100));
          setTitle(data.event_title ?? "");
          setInfo(data.event_info ?? "");
          setPosterUrl(data.poster_url ?? null);
        }
        setLoading(false);
      });
  }, []);

  const save = async (patch?: { poster_url?: string | null }) => {
    const cap = parseInt(capacity, 10);
    if (!patch && (!cap || cap < 1 || cap > 10000)) {
      toast.error("Ange ett maxantal mellan 1 och 10000");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("event_settings")
      .update({
        capacity: Number.isFinite(cap) && cap > 0 ? cap : 100,
        event_title: title.trim() || null,
        event_info: info.trim() || null,
        ...(patch ?? {}),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Kunde inte spara inställningarna");
      return;
    }
    toast.success("Inställningarna är sparade");
    onChange?.();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Välj en bildfil");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("Bilden får vara max 100 MB");
      return;
    }
    setUploading(true);

    let optimized;
    try {
      optimized = await optimizeImage(file);
    } catch {
      setUploading(false);
      toast.error("Kunde inte bearbeta bilden. Prova en annan fil.");
      return;
    }

    const path = `poster-${Date.now()}.${optimized.extension}`;
    const { error: uploadError } = await supabase.storage.from("event-assets").upload(path, optimized.blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: optimized.contentType,
    });
    if (uploadError) {
      setUploading(false);
      toast.error("Uppladdningen misslyckades");
      return;
    }
    const { data: signed, error: signedError } = await supabase.storage
      .from("event-assets")
      .createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (signedError || !signed?.signedUrl) {
      toast.error("Kunde inte skapa en länk till bilden");
      return;
    }
    setPosterUrl(signed.signedUrl);
    await save({ poster_url: signed.signedUrl });
  };


  const removePoster = async () => {
    setPosterUrl(null);
    await save({ poster_url: null });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="w-5 h-5" />
          Event
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="capacity">Maxantal platser</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            max={10000}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Både bokade biljetter och VIP-gäster räknas in.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Rubrik på startsidan</Label>
          <Input id="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="info">Information om eventet</Label>
          <Textarea id="info" rows={4} maxLength={800} value={info} onChange={(e) => setInfo(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Affisch / bakgrundsbild</Label>
          {posterUrl && (
            <img src={posterUrl} alt="Affisch för eventet" className="w-full rounded-lg border border-border object-cover max-h-56" />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageUp className="w-4 h-4 mr-2" />}
              {posterUrl ? "Byt bild" : "Ladda upp bild"}
            </Button>
            {posterUrl && (
              <Button type="button" variant="destructive" onClick={removePoster} disabled={uploading}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <p className="text-xs text-muted-foreground">
            Stora bilder går bra (upp till 100 MB) – de förminskas och sparas automatiskt i ett snabbt webbformat.
          </p>

        </div>

        <Button className="w-full" onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-4 h-4 mr-2" />Spara</>)}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventSettingsTab;
