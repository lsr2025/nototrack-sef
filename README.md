# NotoTrack - YMS × IDC SEF Spaza Shop Profiling PWA

A complete, production-ready Progressive Web App for profiling spaza shops in rural KwaZulu-Natal. Built for 451 field agents in Workstream A, Enterprise iLembe.

## Features

- **Offline-First Architecture**: Complete functionality without internet connectivity
- **12-Step Assessment Wizard**: Structured form for comprehensive shop profiling
- **Role-Based Access Control**: 5-tier permission system from Executive to M&E/Funder
- **Compliance Scoring**: Automatic scoring system (0-100 points) with 4 eligibility tiers
- **Auto-Sync Queue**: Offline data syncs automatically when connection restored
- **PWA Support**: Installable as native app on mobile devices
- **IndexedDB Storage**: Local data persistence without external dependencies

## Tech Stack

- **Framework**: Next.js 14.2.5
- **UI**: Tailwind CSS 3.4.1
- **Database**: Supabase PostgreSQL (with SSR support)
- **Auth**: Supabase Auth
- **Storage**: IndexedDB + Supabase
- **PWA**: next-pwa 5.6.0
- **Language**: TypeScript 5

## Project Structure

```
nototrack/
├── app/                          # Next.js app directory
│   ├── page.tsx                 # Login page (/)
│   ├── layout.tsx               # Root layout with metadata
│   ├── globals.css              # Global styles + animations
│   ├── dashboard/
│   │   └── page.tsx             # Dashboard with role-based views
│   ├── assessment/
│   │   └── new/
│   │       └── page.tsx         # 12-step assessment wizard
│   ├── submissions/
│   │   └── page.tsx             # Submissions list with sync status
│   └── profile/
│       └── page.tsx             # User profile & offline status
├── components/                   # React components
│   ├── OfflineBanner.tsx        # Online/offline status indicator
│   ├── BottomNav.tsx            # Navigation bar (Home, New, Submissions, Profile)
│   └── SyncIndicator.tsx        # Pending sync count badge
├── lib/                          # Utilities & logic
│   ├── supabase.ts              # Browser Supabase client
│   ├── supabase-server.ts       # Server Supabase client
│   ├── offline-db.ts            # IndexedDB wrapper (no external deps)
│   ├── types.ts                 # TypeScript interfaces
│   ├── compliance.ts            # Compliance scoring logic
│   └── wizard-steps.ts          # Assessment form definition
├── middleware.ts                 # Auth middleware
├── public/
│   ├── manifest.json            # PWA manifest
│   └── icon-*.png               # App icons (192x512 + maskable)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
└── next.config.mjs
```

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables** (already configured in `.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://rwkdcreimzpieennuwnj.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Usage

### Authentication
- Users log in with their **Employee ID** (e.g., `YMS-A-P-001`) and password
- Email format internally: `{employee_id}@nototrack.co.za`
- Default password is the employee_id

### Role Tiers
| Tier | Role | Access |
|------|------|--------|
| 1 | Executive | Full programme stats, all submissions |
| 2 | District Coordinator | Workstream-wide stats, all supervisors |
| 3 | Field Supervisor | Locality stats, own team submissions |
| 4 | Field Agent/Participant | Own submissions only |
| 5 | M&E/Funder | Read-only access to all data |

### Assessment Wizard

The core 12-step form for profiling each spaza shop:

1. **Shop Name** (Text, required)
2. **Owner Name** (Text)
3. **Contact Number** (Tel)
4. **GPS Coordinates** (Location capture)
5. **Street Address** (Text)
6. **Formal Registration** (Yes/No)
7. **CIPC Registration** (Yes/No)
8. **Tax Compliance** (Yes/No)
9. **Business Bank Account** (Yes/No)
10. **Employs Staff** (Yes/No, with follow-up count)
11. **Stock Value** (Select from 4 ranges)
12. **Review & Submit**

### Compliance Scoring

Automatic calculation based on answers:
- Formally registered: +25 points
- CIPC registration: +20 points
- Tax compliant: +20 points
- Business bank account: +20 points
- Employs staff: +10 points
- Stock value > R20k: +5 points

**Tiers**:
- **Tier 1** (80-100): NEF Eligible - Green
- **Tier 2** (60-79): Conditionally Eligible - Blue
- **Tier 3** (40-59): Needs Support - Yellow
- **Tier 4** (0-39): Critical - Red

### Offline Mode

When offline:
- All assessments are saved to IndexedDB
- Status shows "Pending Sync"
- App displays offline banner
- When connection restored, data auto-syncs
- Pending count shown on dashboard

## Data Storage

### Supabase Tables

**nototrack.assessments**:
```sql
id UUID (PK)
offline_id TEXT (unique, for offline-synced records)
agent_id UUID (FK to users)
shop_name TEXT (required)
owner_name TEXT
contact TEXT
gps_lat DECIMAL
gps_lng DECIMAL
address TEXT
is_registered BOOLEAN
has_cipc BOOLEAN
tax_compliant BOOLEAN
has_bank_account BOOLEAN
employs_staff BOOLEAN
staff_count INTEGER
stock_value TEXT
compliance_score INTEGER
compliance_tier INTEGER
status TEXT ('submitted'|'synced')
created_at TIMESTAMPTZ
synced_at TIMESTAMPTZ
```

### IndexedDB Stores

**assessments** (offline drafts):
- Key: `offline_id`
- Stores partial/complete assessments locally

**queue** (sync queue):
- Key: `id`
- Tracks pending records: `{ id, type, data, created_at, status: 'pending'|'synced'|'failed' }`

## Colour Palette

- **Dark** (`#0D1B35`): Primary background
- **Navy** (`#1A2D5A`): Cards, secondary background
- **Teal** (`#0D7A6B`): Accent, buttons, active states
- **Gold** (`#D4A017`): Secondary accent
- **White** (`#FFFFFF`): Text

## Development

### Code Style
- TypeScript strict mode enabled
- ESLint configuration extends Next.js core-web-vitals
- All client components use `'use client'` directive
- Tailwind CSS for all styling

### Key Files to Modify

- **Assessment form**: `lib/wizard-steps.ts`
- **Scoring logic**: `lib/compliance.ts`
- **Offline logic**: `lib/offline-db.ts`
- **Supabase config**: `lib/supabase.ts`, `lib/supabase-server.ts`
- **Role-based views**: `app/dashboard/page.tsx`

### Testing Offline Mode

1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from the throttling dropdown
4. All data will queue locally
5. Switch back to "Online" to see auto-sync

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables in project settings
4. Deploy

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## API Endpoints Used

- `POST /auth/v1/token` - Sign in
- `POST /auth/v1/user` - Get session
- `POST /rest/v1/assessments` - Insert assessment
- `GET /rest/v1/assessments` - Get submissions
- `GET /rest/v1/users` - Get user profile

## Known Limitations

- GPS capture requires HTTPS in production
- PWA offline mode limited by browser storage (~50MB IndexedDB limit)
- Sync queue handles up to ~1000 records without performance issues
- No real-time collaboration (designed for individual agents)

## Future Enhancements

- Photo capture for proof of location
- Offline maps support
- Bulk export to CSV
- Advanced analytics dashboard
- Multi-language support
- Voice input for assessments

## Support

For issues or questions:
- Check the Supabase dashboard for authentication issues
- Enable browser DevTools console for debugging
- Verify internet connection for sync problems
- Clear IndexedDB cache if data persists incorrectly

## License

Copyright 2024 YMS × IDC Social Employment Fund. All rights reserved.

---

**Version**: 1.0.0
**Last Updated**: 2026-03-20
**Target Users**: 451 field agents (Workstream A, Enterprise iLembe)
