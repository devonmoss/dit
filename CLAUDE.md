# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start development server with turbopack
npm run dev

# Build the project
npm run build

# Start production server
npm run start
```

### Testing
```bash
# Run all jest unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run end-to-end tests with Playwright
npm run test:e2e

# Run end-to-end tests with Playwright UI
npm run test:e2e:ui

# Run all tests (unit and e2e)
npm run test:all
```

### Code Quality
```bash
# Run ESLint
npm run lint
```

## Project Architecture

### Core Concepts

1. **Morse Code Training Application** - A Next.js app for learning and practicing Morse code, with both "copy" (listening) and "send" (typing) modes.

2. **Authentication System** - Uses Supabase for user authentication, supporting both email/password and GitHub OAuth.

3. **XP and Level System** - Users earn XP for completing exercises, with progression through levels and tiers.

4. **Race Mode** - Competitive mode where users can race against each other in real-time using Supabase's Realtime features.

5. **Iambic Keyer** - A virtual Morse code keyer for "send" mode training, controlled with keyboard arrow keys.

### Key Architecture Components

#### State Management
- React Context used for global state management via contexts:
  - `AppStateContext` - Core application state (levels, WPM, volume, etc.)
  - `AuthContext` - User authentication and XP information
  - `CharPointsContext` - Character mastery tracking

#### Realtime Features
- Supabase Realtime for race mode functionality
- Channel-based communication for race progress and user presence

#### Data Storage
- Supabase PostgreSQL database for storing user data, race results, and XP history
- LocalStorage for device-specific settings like WPM, volume, etc.

#### Audio System
- Web Audio API for playing Morse code sounds
- Customizable WPM (words per minute) and volume

#### Hooks Architecture
- Custom React hooks encapsulate core functionality:
  - `useIambicKeyer` - Virtual Morse code keyer implementation
  - `useMorseAudio` - Audio playback system
  - `useRaceChannel` - Realtime race communication
  - `useAuth` - Authentication functionality
  - Various race stage hooks (`useRaceCountdownStage`, etc.)

### Key Files and Their Purpose

- `/contexts/AppStateContext.tsx` - Central application state management
- `/hooks/useIambicKeyer.ts` - Virtual Morse code keyer implementation
- `/utils/morse.ts` - Morse code utilities and audio playback
- `/utils/levels.ts` - Training level definitions and progression
- `/hooks/useRaceChannel.ts` - Realtime race communication system

### Database Schema (Supabase)

Key tables include:
- `profiles` - User profiles with username and XP information
- `races` - Race instances and their status
- `race_participants` - Users participating in races
- `xp_history` - Record of XP awards and activities

## Current Development Focus

Based on the current branch and issues:
- Cleaning up debug logging across the application
- Improving race mode functionality
- Enhancing the XP/leveling system UI
- Implementing UI improvements (auth panel, training feedback, icons)
- Adding sound effects for various game events
- Improving user statistics page

## Testing Considerations

Jest tests focus on:
- Iambic keyer functionality
- Component tests for SendingMode and race flow
- Anonymous user hook functionality

Playwright tests cover:
- End-to-end functionality, particularly sending mode