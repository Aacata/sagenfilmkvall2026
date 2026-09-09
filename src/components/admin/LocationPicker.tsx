import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  address: string;
  onChange: (value: { lat: number; lng: number; address?: string }) => void;
}

const DEFAULT_CENTER: [number, number] = [59.3293, 18.0686];

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:hsl(var(--primary));border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const LocationPicker = ({ lat, lng, address, onChange }: LocationPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
    const map = L.map(containerRef.current, { attributionControl: true }).setView(start, lat != null ? 16 : 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    if (lat != null && lng != null) {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: la, lng: ln } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current!.getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });
      }
      onChangeRef.current({ lat: la, lng: ln });
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    const q = (query.trim() || address.trim());
    if (!q) {
      toast.error("Skriv en adress att söka efter");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!results.length) {
        toast.error("Hittade ingen plats med den adressen");
        return;
      }
      const la = parseFloat(results[0].lat);
      const ln = parseFloat(results[0].lon);
      const map = mapRef.current;
      if (map) {
        map.setView([la, ln], 17);
        if (markerRef.current) {
          markerRef.current.setLatLng([la, ln]);
        } else {
          markerRef.current = L.marker([la, ln], { icon: pinIcon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLatLng();
            onChangeRef.current({ lat: p.lat, lng: p.lng });
          });
        }
      }
      onChange({ lat: la, lng: ln, address: address.trim() ? undefined : results[0].display_name });
    } catch {
      toast.error("Kunde inte söka just nu, prova igen");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Sök adress, t.ex. Storgatan 12, Stockholm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      <div ref={containerRef} className="h-64 w-full rounded-lg border border-border overflow-hidden z-0" />
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {lat != null && lng != null
          ? `Nål satt: ${lat.toFixed(5)}, ${lng.toFixed(5)} – klicka på kartan eller dra nålen för att flytta.`
          : "Klicka på kartan för att sätta en nål, eller sök på adressen ovan."}
      </p>
    </div>
  );
};

export default LocationPicker;
