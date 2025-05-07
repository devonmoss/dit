# Continuous Wave

Yet another application to learn morse code with an emphasis on fun and a focus of getting you on the air.

## Features

- **Multiple Training Modes**:
  - Copy Mode (listening to Morse code)
  - Send Mode (typing Morse code with iambic keyer)
  - Race Mode (compete with others in real-time)
  - Zen Mode (freestyle practice)

- **Progression System**:
  - XP-based leveling system
  - Character mastery tracking
  - Structured training levels

- **Real-time Multiplayer**:
  - Race against others
  - Live progress tracking
  - Race invitations

- **Personalization**:
  - Adjustable WPM (words per minute)
  - Volume controls
  - Theme customization

## Tech Stack

- **Next.js**: React framework for production
- **TypeScript**: Type-safe JavaScript
- **Supabase**: Backend as a Service for authentication and data storage
- **CSS Modules**: Component-scoped CSS styling

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Setting up Supabase Locally

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Start the local Supabase stack:
   ```bash
   supabase start
   ```

3. Apply migrations to your local Supabase instance:
   ```bash
   supabase migration up
   ```

4. Seed the database with initial data:
   ```bash
   supabase db reset
   ```

5. Get your local Supabase URL and anon key:
   ```bash
   supabase status
   ```

6. Create a `.env.local` file in the project root with your local Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/components`: React components
- `/contexts`: State management contexts
- `/hooks`: Custom React hooks
- `/pages`: Next.js pages
- `/public`: Static assets
- `/styles`: Global styles
- `/utils`: Utility functions and helpers
- `/supabase`: Database migrations and seed data

## Testing

```bash
# Run all tests
npm run test:all

# Run only unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e

# Run end-to-end tests with UI
npm run test:e2e:ui
```

## Roadmap

### Upcoming Features

- **Advanced Training Content**:
  - Punctuation-focused training levels
  - Prosign training (CW operation shorthand)
  - Call sign training with properly formatted examples

- **POTA Integration**:
  - POTA (Parks on the Air) contact exercises
  - Activator and hunter simulation
  - Interactive POTA-style QSO practice

- **User Experience Improvements**:
  - Performance metrics tracking and visualization
  - Custom call sign playback
  - User-created custom practice levels
  - Advanced theme customization

### Some Nice Refinements Would Be
- Adding sound effects for game events
- Implementing UI animations and visual feedback
- Improving user statistics dashboard
- Adding comprehensive icon system

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)