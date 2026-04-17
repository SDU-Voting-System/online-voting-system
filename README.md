# Online Voting System

A secure, modern web-based election voting platform built for educational institutions. Features real-time vote tallying, admin dashboard, and Firebase backend integration.

## Features

- Secure Voter Authentication - OTP-based login via EmailJS with matric number verification
- Admin Dashboard - Manage candidates, positions, voters, and polls with real-time analytics
- Candidate Photo Upload - Base64 image support (< 1MB) with Firestore integration
- Live Vote Analytics - Real-time voting tallies and participation metrics
- Reset Election - One-click database reset to prepare for new elections
- Admin Bypass - Hardcoded admin credentials for system access even with empty database
- Responsive Design - Mobile-first UI with Tailwind CSS and shadcn-ui components

## Project Structure

```
src/
├── pages/              # Main application pages
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── AdminDashboard.tsx
│   ├── VoterDashboard.tsx
│   └── VotingBooth.tsx
├── components/         # Reusable UI components
│   └── ui/            # shadcn-ui components
├── store/             # Zustand state management
├── hooks/             # Custom React hooks
└── lib/               # Utilities and helpers
```

## Installation & Setup

### Prerequisites
- Node.js v18+ and npm
- Firebase project with Firestore database
- EmailJS account for OTP delivery

### Getting Started

```sh
# Step 1: Clone the repository
git clone https://github.com/SDU-Voting-System/online-voting-system.git

# Step 2: Navigate to project directory
cd online-voting-system

# Step 3: Install dependencies
npm install

# Step 4: Create .env file and add your Firebase and EmailJS credentials
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_PROJECT_ID=...
# (See firebase.js for required variables)

# Step 5: Start development server
npm run dev
```

## Available Scripts

```sh
npm run dev          # Start development server (http://localhost:8080)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:watch   # Run tests in watch mode
npm run deploy       # Deploy to GitHub Pages
```

## Default Admin Credentials

For system administration and setup:
- Matric Number: `ADMIN/001`
- Email: `admin@university.edu`

These credentials provide immediate access to the admin dashboard without OTP verification, even if the eligible students database is empty.

## Deployment

This project is configured for GitHub Pages deployment.

### Deploy to GitHub Pages

```sh
npm run deploy
```

The build process will:
1. Run `npm run build` to create optimized production files
2. Deploy the `dist` folder to the `gh-pages` branch
3. Make your site live at: `https://Webcraft-lab.github.io/online-voting-system/`

Note: The app uses `HashRouter` for routing, ensuring that page refreshes don't result in 404 errors on GitHub Pages.

## How to Edit & Contribute

### Local Development

Edit files in your preferred IDE (VS Code recommended):

```sh
npm run dev
```

Changes will auto-refresh in the browser.

### Push Changes to GitHub

```sh
git add .
git commit -m "Your commit message"
git push origin main
```

Then redeploy:
```sh
npm run deploy
```

### Edit Files Directly on GitHub

1. Navigate to the file in the repository
2. Click the "Edit" button (pencil icon)
3. Make changes and commit

## Technologies Used

This project is built with:

- Vite - Lightning-fast build tool and dev server
- TypeScript - Type-safe JavaScript development
- React 18 - UI library with hooks and state management
- Zustand - Lightweight state management
- Firebase/Firestore - Cloud backend and real-time database
- shadcn-ui - High-quality React components
- Tailwind CSS - Utility-first CSS framework
- Framer Motion - Smooth animations and transitions
- EmailJS - Email delivery for OTP codes
- ExcelJS - Excel file parsing for bulk voter uploads
- React Router - Client-side routing with HashRouter
