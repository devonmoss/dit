# Morse Code Trainer (Next.js Version)

This is a Next.js version of the Morse Code Trainer application, migrated from the original vanilla JavaScript version.

## Migration Status

This project is currently under migration from vanilla JavaScript to Next.js. The following features have been implemented:

- ✅ Core application structure with TypeScript support
- ✅ Application state management with React Context
- ✅ Authentication with Supabase
- ✅ Morse code utilities and audio playback
- ✅ Training levels system
- ✅ Copy mode training (listening to Morse code)

Features still pending implementation:

- 🔄 Send mode (typing Morse code)
- 🔄 Race mode (competitive Morse code)
- 🔄 Progress dashboard

## Tech Stack

- **Next.js**: React framework for production
- **TypeScript**: Type-safe JavaScript
- **Supabase**: Backend as a Service for authentication and data storage
- **CSS Modules**: Component-scoped CSS styling

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/components`: React components
- `/contexts`: State management contexts
- `/hooks`: Custom React hooks
- `/pages`: Next.js pages
- `/public`: Static assets
- `/styles`: Global styles
- `/utils`: Utility functions and helpers

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
