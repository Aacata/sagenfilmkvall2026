import { cn } from "@/lib/utils";
import type { Seat } from "@/data/seatLayout";
import { Accessibility, Check, Heart } from "lucide-react";

interface SeatIconProps {
  seat: Seat;
  isSelected: boolean;
  onClick: () => void;
}

const SeatIcon = ({ seat, isSelected, onClick }: SeatIconProps) => {
  const isDisabled = seat.isBooked;

  const baseClasses =
    "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer transition-all duration-150 border border-transparent hover:scale-110";

  const colorClasses = isSelected
    ? "bg-[hsl(var(--seat-selected))] text-white border-white/40 scale-110"
    : seat.isBooked
      ? "bg-[hsl(var(--seat-booked))] text-white/80 cursor-not-allowed opacity-70"
      : seat.type === "vip"
        ? "bg-[hsl(var(--seat-vip))]/30 text-[hsl(var(--seat-vip))] border-[hsl(var(--seat-vip))]/50 hover:bg-[hsl(var(--seat-vip))]/50"
        : seat.type === "wheelchair"
          ? "bg-[hsl(var(--seat-wheelchair))]/20 text-[hsl(var(--seat-wheelchair))] border-[hsl(var(--seat-wheelchair))]/40 hover:bg-[hsl(var(--seat-wheelchair))]/40"
          : seat.type === "couple"
            ? "w-16 bg-[hsl(var(--seat-couple))]/20 text-[hsl(var(--seat-couple))] border-[hsl(var(--seat-couple))]/40 hover:bg-[hsl(var(--seat-couple))]/40"
            : "bg-[hsl(var(--seat-available))] text-white/70 hover:bg-[hsl(var(--seat-available))]/80";

  return (
    <button
      className={cn(baseClasses, colorClasses)}
      onClick={onClick}
      disabled={isDisabled}
      title={`Rad ${seat.row}, Plats ${seat.seatNumber}${seat.type === "vip" ? " (VIP)" : ""}${seat.type === "wheelchair" ? " (Rullstol)" : ""}${seat.type === "couple" ? " (Par)" : ""}`}
    >
      {isSelected ? (
        <Check className="w-4 h-4" />
      ) : seat.type === "wheelchair" ? (
        <Accessibility className="w-4 h-4" />
      ) : seat.type === "couple" ? (
        <Heart className="w-4 h-4" />
      ) : (
        seat.seatNumber
      )}
    </button>
  );
};

export default SeatIcon;
