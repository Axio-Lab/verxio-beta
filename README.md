# Verxio Checkout

A Next.js application for Verxio's loyalty native checkout experience with a mobile-first design.

## Features

- **Authentication**: Email-based authentication using Privy
- **Mobile-First Design**: Responsive UI that looks like a mobile app
- **Solana Integration**: Built for Solana blockchain
- **Modern UI**: Built with Tailwind CSS and shadcn/ui components
- **TypeScript**: Full TypeScript support

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Authentication**: Privy
- **Language**: TypeScript
- **Blockchain**: Solana

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
   PRIVY_APP_SECRET=your-privy-app-secret
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── dashboard/          # Dashboard page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── providers.tsx      # Privy provider
├── components/
│   └── ui/               # shadcn/ui components
└── lib/
    └── utils.ts          # Utility functions
```

## Authentication Flow

1. Users land on the home page
2. Click "Sign In with Email" to authenticate with Privy
3. Enter email and receive one-time password
4. Upon successful authentication, redirected to dashboard
5. Users can sign out from the dashboard

## Mobile App Layout

The application features a mobile app-like interface with:

- **Header**: Logo on the left, notification and settings icons on the right
- **Main Content**: Scrollable content area with cards and actions
- **Bottom Navigation**: Five navigation items (Home, Dashboard, Create, Transaction, Profile)

## Development

- **Styling**: Black and white theme with gradual component library expansion
- **Components**: Using shadcn/ui for consistent, accessible components
- **Responsive**: Mobile-first design that works on all screen sizes

## Next Steps

- Add more pages for each navigation item
- Implement actual checkout functionality
- Add Solana wallet integration
- Build out the component library
- Add more interactive features
