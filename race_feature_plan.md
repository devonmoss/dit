# Multiplayer Real-time Morse Code Speed Test (Race Mode)

## Overview
We want to add a new real-time, multiplayer "race" mode to our Morse code speed test website. Users can create a shared race session (either in "copy" or "send" mode), invite friends via a shareable link, and compete to decode Morse code characters as quickly as possible.

## High-Level Requirements
1. Add a new menu item next to **Custom** linking to `#/race` (or `/race`).
2. The `/race` page presents options to:
   - Create a new race in **copy** mode (decode incoming code)
   - Create a new race in **send** mode (encode given text)
3. On race creation:
   - Generate a unique race ID (e.g. `xyz1234`).
   - Redirect host to `/race/:raceId`.
4. Joining a race:
   - Visiting `/race/:raceId` joins the lobby.
   - Display the count of connected players and their usernames (if logged in) or guest IDs.
5. Lobby and start:
   - Any connected player may click **Start Race**.
   - Trigger a 5-second countdown visible to all clients.
6. Race execution:
   - Server sequentially emits single characters to all clients via Supabase Realtime channel (identical stream).
   - Client plays Morse tone for each character and prompts user to input the corresponding letter.
   - On keypress, client emits an **answer** event for validation.
   - Server validates; if correct, emits next character. If incorrect, optionally record error/time penalty.
7. Finish:
   - When the sequence is complete, broadcast results (time, accuracy) to all clients.
   - Show leaderboard in the race room.

## User Stories
- As a user, I can navigate to **Race** from the main menu.
- As a host, I can create a new race in copy or send mode.
- As a participant, I can join a race via its shareable link.
- As any participant, I can see who is in the lobby and start the race.
- As a participant, I can decode/encode Morse code in real time and see my ranking at the end.

## Technical Design

### Frontend
- **Menu**: Update navigation component to include a **Race** link.
- **Routes**:
  - `/race`: Race lobby page (create or join).
  - `/race/:id`: Active race room.
- **Components**:
  - `RaceSetup` (mode selector + create button + join form).
  - `RaceLobby` (participant list + start button).
  - `RaceView` (countdown, character display, input field, timer).
  - `RaceResults` (leaderboard).
**Supabase Realtime Client**:
  - Initialize Supabase client and subscribe to `race:<id>` channel.
  - Use Realtime presence to track participants; display joined users and usernames.
  - Listen for broadcast events on the channel:
    - `lobby:update` (presence change) to refresh participant list.
    - `race:countdown` (payload: seconds) to display countdown.
    - `race:char` (payload: character) to play tone and prompt input.
    - `race:end` (payload: results) to render leaderboard.
  - Broadcast client actions via channel or Edge Function calls:
    - `race:create` (mode) -> Edge Function triggers channel and record creation.
    - `race:join` -> handled via presence tracking on subscribe.
    - `race:start` -> call Edge Function to initiate countdown.
    - `race:answer` (char, answer) -> call Edge Function HTTP endpoint for validation.

### Backend
**Supabase Edge Functions & Realtime**:
**Data Models** (PostgreSQL via Supabase):
  - `races` table:
    - `id` (text, primary key)
    - `mode` (`copy` | `send`)
    - `status` (`lobby` | `countdown` | `in_progress` | `finished`)
    - `sequence` (text array or text)
  - `results` table:
    - `race_id` (fk → `races.id`)
    - `user_id` (nullable)
    - `username` (text)
    - `correct` (integer)
    - `time_ms` (integer)

**Edge Functions**:
  - `POST /functions/race/create` → create race record, return `{ id, joinUrl }`
  - `GET /functions/race/:id` → fetch race metadata (mode, status, sequence)
  - `POST /functions/race/:id/start` → set status to `countdown`, broadcast `race:countdown`, schedule character stream
  - `POST /functions/race/:id/answer` → validate answer; record partial results; broadcast `race:char` or `race:end`

**Realtime Channel** (`race:<id>`):
  - Clients subscribe via `supabase.channel('race:' + id)` with presence tracking (`channel.track({ user_id, username })`).
  - Edge Functions use Supabase Admin client to broadcast messages:
    - `channel.send({ type: 'broadcast', event: 'lobby:update', payload })`
    - `channel.send({ type: 'broadcast', event: 'race:countdown', payload: { seconds } })`
    - `channel.send({ type: 'broadcast', event: 'race:char', payload: { char } })`
    - `channel.send({ type: 'broadcast', event: 'race:end', payload: { results } })`

## Sequence Diagram
1. Client A → `race:create` → Server → returns `id`
2. Client A and B → `/race/:id` → `race:join` → server broadcasts `lobby:update`
3. Client B → `race:start` → server broadcasts `race:countdown` (5..1)
4. Server → `race:char`(`H`) → all clients play tone and wait input
5. Client A → `race:answer`(`H`) → server validates and sends next char
6. ... repeat until done → server broadcasts `race:end` with results

## Milestones & Next Steps
1. **Setup**: Configure Supabase project, enable Edge Functions and Realtime presence.
2. **Menu & Routing**: Add Race link and stub pages (`/race`, `/race/:id`).
3. **Backend Model & Endpoints**: Implement race creation and join logic.
4. **Lobby UI**: Show participants and start button.
5. **Countdown & Char Flow**: Implement countdown and real-time character stream.
6. **Answer Validation**: Handle user input and server-side validation.
7. **Results & Leaderboard**: Compute and display final rankings.
8. **Polish & Testing**: Responsive design, error handling, automated tests.

---
_Generated planning document for the Race feature._