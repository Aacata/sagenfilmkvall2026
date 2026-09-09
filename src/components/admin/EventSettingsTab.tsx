import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ImageUp, Loader2, QrCode, Save, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { optimizeImage } from "@/lib/optimizeImage";
import LocationPicker from "@/components/admin/LocationPicker";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const PUBLIC_URL = "https://sagenfilmkvall.lovable.app";


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
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [taken, setTaken] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data }, { count: ticketCount }, { count: vipCount }] = await Promise.all([
        supabase
          .from("event_settings")
          .select("capacity, event_title, event_info, event_location, event_time, poster_url, event_lat, event_lng")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("tickets").select("id", { count: "exact", head: true }),
        supabase.from("vip_guests").select("id", { count: "exact", head: true }),
      ]);
      if (data) {
        setCapacity(String(data.capacity ?? 100));
        setTitle(data.event_title ?? "");
        setInfo(data.event_info ?? "");
        setLocation(data.event_location ?? "");
        setTime(data.event_time ?? "");
        setPosterUrl(data.poster_url ?? null);
        setLat(data.event_lat ?? null);
        setLng(data.event_lng ?? null);
      }
      setTaken((ticketCount ?? 0) + (vipCount ?? 0));
      setLoading(false);
    };
    load();
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
        event_location: location.trim() || null,
        event_time: time.trim() || null,
        event_lat: lat,
        event_lng: lng,
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

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(PUBLIC_URL)}&format=png&margin=20`;

  const downloadQr = async () => {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("Kunde inte hämta QR-koden");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sagen-filmkvall-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("QR-koden laddas ner");
    } catch {
      toast.error("Kunde inte ladda ner QR-koden");
    }
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
          <p className="text-xs text-muted-foreground">
            Både bokade biljetter och VIP-gäster räknas in. Just nu är {taken} platser tagna. Ändringar här påverkar
            aldrig befintliga bokningar.
          </p>
          {Number(capacity) > 0 && Number(capacity) < taken && (
            <p className="text-xs text-destructive">
              Maxantalet är lägre än de {taken} platser som redan är tagna. Inga bokningar tas bort – det går bara inte
              att boka fler tills antalet höjs.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Eventnamn / rubrik på startsidan</Label>
          <Input id="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">Plats</Label>
            <Input
              id="location"
              maxLength={120}
              placeholder="T.ex. Sägen, Storgatan 12"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Tid</Label>
            <Input
              id="time"
              maxLength={120}
              placeholder="T.ex. Lördag 14 mars kl 19:00"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Karta – sätt en nål på platsen</Label>
          <LocationPicker
            lat={lat}
            lng={lng}
            address={location}
            onChange={({ lat: la, lng: ln, address }) => {
              setLat(la);
              setLng(ln);
              if (address && !location.trim()) setLocation(address.slice(0, 120));
            }}
          />
          {lat != null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setLat(null); setLng(null); }}>
              Ta bort nålen
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Nålen används för vägbeskrivningen som gästerna får när de klickar på platsen på startsidan. Glöm inte att
            spara.
          </p>
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

        <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <Label className="text-base font-medium">QR-kod för affisch / flyer</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Ladda ner en högupplöst QR-kod att placera på affischer eller flyers. Koden leder till bokningssidan.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img
              src={qrUrl}
              alt="QR-kod till bokningssidan"
              className="w-40 h-40 rounded-lg border border-border bg-white"
            />
            <div className="flex flex-col gap-2 items-start">
              <p className="text-sm font-medium break-all">{PUBLIC_URL}</p>
              <Button type="button" variant="outline" onClick={downloadQr}>
                <Download className="w-4 h-4 mr-2" />
                Ladda ner PNG
              </Button>
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-4 h-4 mr-2" />Spara</>)}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventSettingsTab;
