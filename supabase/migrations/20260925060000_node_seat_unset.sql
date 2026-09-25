-- CODE-018: a node whose seat was never set writes seat 0, and it was stored
-- as 0, which is the cox's seat on a boat (seats.seat_number). A node never
-- sits there, so an unset seat is now stored as null (lib/session/parse.ts),
-- which the pages show as "seat ?" and the history chart leaves out.
--
-- Node sessions already stored with 0 become null. A side the coach set on
-- one was kept on its boat's seat 0 (app/app/(dash)/cox/actions.ts); it moves
-- onto the session, where a seat with no number keeps its side.
update public.sessions s
   set side = coalesce(s.side, st.side)
  from public.seats st
 where s.kind = 'node' and s.seat_number = 0
   and st.boat_id = s.boat_id and st.seat_number = 0;

update public.sessions set seat_number = null where kind = 'node' and seat_number = 0;

alter table public.sessions
  add constraint sessions_node_seat_check check (kind <> 'node' or seat_number between 1 and 8);

comment on column public.sessions.seat_number is
  'Seat a node session was rowed in, 1 to 8; null when the node''s seat was never set.';
