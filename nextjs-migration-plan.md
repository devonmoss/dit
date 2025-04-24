# Next.js Migration Plan for Morse Code Trainer

## Phase 1: Setup & Structure
1. **Create Next.js project**
   ```
   npx create-next-app@latest morse-trainer-next
   ```
2. **Set up Supabase client**
   - Install package: `npm install @supabase/supabase-js`
   - Create utils/supabase.js for client initialization

3. **Create folder structure**
   ```
   /pages
     - index.js (main app)
     - _app.js (app wrapper)
   /components
     - Layout.js
     - TopMenu.js
     - MasteryDisplay.js
     - AuthPanel.js
     - TrainingMode.js
     - SendingMode.js
     - RaceMode.js
   /contexts
     - AuthContext.js
     - AppStateContext.js
   /hooks
     - useAudio.js
     - useMorse.js
   /utils
     - supabase.js
     - morse.js (morse code mappings)
   /public
     - (static assets)
   ```

## Phase 2: Core Functionality Migration
1. **Move configuration & constants**
   - Extract morse mapping, levels, etc. to separate utility files
   
2. **Create React context for state management**
   - Move global state (selectedLevel, charPoints, etc.) to contexts

3. **Implement core audio functionality**
   - Create custom hook `useAudio.js` for Morse playback
   - Handle timing functionality in a clean, testable way

## Phase 3: Component Implementation
1. **Implement UI components**
   - Break down monolithic HTML/JS into React components
   - Create TopMenu, MasteryDisplay, etc.

2. **Authentication flow**
   - Convert auth.js to React hooks/context pattern
   - Create AuthContext and login/signup components

3. **Training modes**
   - Implement copy training component
   - Implement send training component
   - Implement race functionality

## Phase 4: Polish & Deployment
1. **CSS migration**
   - Convert to CSS modules or styled-components
   - Organize styles alongside components

2. **Implement routing**
   - Use Next.js routing for different modes

3. **Testing**
   - Add basic tests for core functionality

4. **Deploy to Vercel**
   - Connect GitHub repo to Vercel
   - Configure environment variables

## Migration Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| Create Next.js project | Completed | Basic Next.js app with TypeScript |
| Setup Supabase client | Completed | Implemented in utils/supabase.ts |
| Create folder structure | Completed | Components, contexts, hooks, utils folders created |
| Move configuration & constants | Completed | Morse mapping and levels extracted to utilities |
| Create state management | Completed | Created AppStateContext and AuthContext |
| Implement audio hooks | Completed | Audio context utilities in morse.ts |
| Implement UI components | In Progress | Completed Layout, TopMenu, AuthPanel, MasteryDisplay, TrainingMode |
| Authentication flow | Completed | Implemented with Supabase in AuthContext and AuthPanel |
| Training modes | In Progress | Copy mode implemented, Send and Race modes pending |
| CSS migration | In Progress | CSS modules for implemented components |
| Routing | Not started | |
| Testing | Not started | |
| Deployment | Not started | |

## Component Migration Status

| Original Feature | Next.js Component | Status | Notes |
|-----------------|-------------------|--------|-------|
| Top menu | TopMenu | Completed | |
| Auth panel | AuthPanel | Completed | |
| Mastery display | MasteryDisplay | Completed | |
| Copy mode | TrainingMode | Completed | |
| Send mode | SendingMode | Not started | |
| Race mode | RaceMode | Not started | |

## Key Challenges
- Audio timing precision in React
- Managing complex state across components
- Preserving user data during migration
- Maintaining feature parity 