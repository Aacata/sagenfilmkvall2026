export type SeatType = "standard" | "wheelchair" | "vip" | "couple" | "empty";

export interface Seat {
  id: string;
  row: number;
  seatNumber: number;
  type: SeatType;
  isBooked: boolean;
  bookedByEmail: string | null;
  bookingId: string | null;
  checkedIn: boolean;
}

export interface RowConfig {
  row: number;
  seats: { type: SeatType; count: number }[];
  offset: number;
}

export const rowConfigs: RowConfig[] = [
  { row: 1, seats: [{ type: "wheelchair", count: 1 }, { type: "empty", count: 2 }, { type: "vip", count: 7 }], offset: 1 },
  { row: 2, seats: [{ type: "standard", count: 12 }], offset: 0 },
  { row: 3, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 4, seats: [{ type: "standard", count: 12 }], offset: 1 },
  { row: 5, seats: [{ type: "standard", count: 12 }], offset: 1 },
  { row: 6, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 7, seats: [{ type: "standard", count: 13 }], offset: 0 },
  { row: 8, seats: [{ type: "standard", count: 12 }], offset: 0 },
  { row: 9, seats: [{ type: "standard", count: 11 }], offset: 1 },
];

export function dbSeatToSeat(row: {
  id: string;
  row_number: number;
  seat_number: number;
  seat_type: string;
  is_booked: boolean;
  booked_by_email: string | null;
  booking_id: string | null;
  checked_in: boolean;
}): Seat {
  return {
    id: row.id,
    row: row.row_number,
    seatNumber: row.seat_number,
    type: row.seat_type as SeatType,
    isBooked: row.is_booked,
    bookedByEmail: row.booked_by_email,
    bookingId: row.booking_id,
    checkedIn: row.checked_in,
  };
}
