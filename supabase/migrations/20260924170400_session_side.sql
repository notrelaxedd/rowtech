-- CODE-006: which side a seat rows was only stored on seats (boat_id,
-- seat_number), and the boat is optional at upload, so for an outing with no
-- boat the port/starboard buttons had nowhere to write. The side of a seat in
-- an outing with no boat is kept on that seat's session instead.
alter table public.sessions add column if not exists side public.seat_side;
comment on column public.sessions.side is
  'Side this seat rowed, set by the coach, when the outing has no boat to keep it on (seats.side otherwise).';
