# NotoTrack Deployment Guide

Complete instructions for deploying NotoTrack to production.

## Prerequisites

- Vercel account (recommended) or other Node.js hosting
- Supabase project already created and configured
- Domain name (optional, but recommended)
- SSL certificate (automatic on Vercel)

## Pre-Deployment Checklist

- [ ] All environment variables configured in `.env.local`
- [ ] Supabase tables created (`nototrack.assessments`)
- [ ] RLS policies configured on Supabase
- [ ] User accounts created in Supabase Auth
- [ ] PWA icons generated (192x192, 512x512)
- [ ] Manifest.json customized if needed
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors: `npm run lint`
- [ ] Tested offline mode locally

## Deployment to Vercel (Recommended)

### Step 1: Prepare Repository

```bash
# Initialize git if not done
git init
git add .
git commit -m "Initial NotoTrack commit"
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in or create account
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Select framework: **Next.js**
6. Configure project name

### Step 3: Environment Variables

In Vercel project settings, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://rwkdcreimzpieennuwnj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3a2RjcmVpbXpwaWVlbm51d25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTQ4ODQsImV4cCI6MjA4OTQ5MDg4NH0.EdOov8vjU9hTZSaS39mo9kbJoxBh7UUD6l7OWYVLvCc
NEXT_PUBLIC_APP_NAME=NotoTrack
NEXT_PUBLIC_WORKSTREAM=A
```

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete (3-5 minutes)
3. Visit your live URL
4. Test login and offline mode

## Alternative: Docker Deployment

### Build Docker Image

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app code
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start server
CMD ["npm", "start"]
EOF

# Build image
docker build -t nototrack:latest .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://rwkdcreimzpieennuwnj.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  nototrack:latest
```

### Push to Container Registry

```bash
# DockerHub
docker tag nototrack:latest yourname/nototrack:latest
docker push yourname/nototrack:latest

# AWS ECR / Google Cloud / Azure
# Follow their specific push instructions
```

## Supabase Configuration

### Create Assessment Table

```sql
CREATE TABLE IF NOT EXISTS nototrack.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offline_id TEXT UNIQUE,
  agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  owner_name TEXT,
  contact TEXT,
  gps_lat DECIMAL(10,8),
  gps_lng DECIMAL(11,8),
  address TEXT,
  is_registered BOOLEAN,
  has_cipc BOOLEAN,
  tax_compliant BOOLEAN,
  has_bank_account BOOLEAN,
  employs_staff BOOLEAN,
  staff_count INTEGER,
  stock_value TEXT,
  compliance_score INTEGER,
  compliance_tier INTEGER,
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_assessments_agent_id ON nototrack.assessments(agent_id);
CREATE INDEX idx_assessments_created_at ON nototrack.assessments(created_at DESC);
CREATE INDEX idx_assessments_status ON nototrack.assessments(status);
CREATE INDEX idx_assessments_offline_id ON nototrack.assessments(offline_id);
```

### Row-Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE nototrack.assessments ENABLE ROW LEVEL SECURITY;

-- Agents can insert their own assessments
CREATE POLICY "agents_insert_own" ON nototrack.assessments
  FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Agents can view their own
CREATE POLICY "agents_view_own" ON nototrack.assessments
  FOR SELECT USING (agent_id = auth.uid());

-- Supervisors can view team assessments
CREATE POLICY "supervisors_view_team" ON nototrack.assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      WHERE u1.id = auth.uid()
      AND u1.role_tier = 3
      AND u1.locality = (
        SELECT u2.locality FROM public.users u2 WHERE u2.id = agent_id
      )
    )
  );

-- Coordinators can view all workstream
CREATE POLICY "coordinators_view_workstream" ON nototrack.assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      WHERE u1.id = auth.uid()
      AND u1.role_tier = 2
      AND u1.workstream = (
        SELECT u2.workstream FROM public.users u2 WHERE u2.id = agent_id
      )
    )
  );

-- Executives can view all
CREATE POLICY "executives_view_all" ON nototrack.assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role_tier = 1
    )
  );
```

## Post-Deployment Testing

### Checklist

- [ ] Login works with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] Dashboard loads with correct user info
- [ ] Can start new assessment
- [ ] All 12 wizard steps work
- [ ] GPS capture works (HTTPS required)
- [ ] Offline mode activates automatically
- [ ] Form saves to IndexedDB when offline
- [ ] Data syncs after coming online
- [ ] Submissions list shows recent assessments
- [ ] Profile page displays correct info
- [ ] Sign out works
- [ ] PWA installable on mobile
- [ ] Offline banner appears/disappears correctly

### Test User Accounts

Create test users in Supabase:

```sql
-- Test Field Agent
INSERT INTO public.users (email, employee_id, full_name, role, role_tier, workstream, municipality, locality)
VALUES (
  'test-agent@nototrack.co.za',
  'YMS-A-P-001',
  'Test Agent',
  'Field Agent',
  4,
  'A',
  'Enterprise iLembe',
  'Test Locality'
);

-- Test Supervisor
INSERT INTO public.users (email, employee_id, full_name, role, role_tier, workstream, municipality, locality)
VALUES (
  'test-supervisor@nototrack.co.za',
  'YMS-A-FS-001',
  'Test Supervisor',
  'Field Supervisor',
  3,
  'A',
  'Enterprise iLembe',
  'Test Locality'
);
```

Then set passwords via Supabase Auth console.

## Monitoring & Analytics

### Vercel Analytics

1. Go to project settings → Analytics
2. Enable Web Analytics (free)
3. Monitor: page views, response times, errors

### Supabase Monitoring

1. Go to your Supabase project
2. Check: Database health, Auth logs, API calls
3. Set up email alerts for errors

### Error Tracking (Optional)

Integrate Sentry:

```bash
npm install @sentry/nextjs
```

## Scaling Considerations

### Database
- For 500+ agents: upgrade Supabase plan
- Enable connection pooling for concurrent users
- Monitor database size (10k+ records/month expected)

### Storage
- IndexedDB: ~50MB per browser
- Consider data cleanup policies after 6 months
- Archive old assessments to cold storage

### Performance
- Enable image optimization (automatic in Next.js)
- Consider CDN for static assets
- Use database query caching for repeated reports

## Maintenance

### Weekly
- Check error logs
- Verify no failed syncs
- Monitor database size

### Monthly
- Review performance metrics
- Update dependencies: `npm update`
- Backup Supabase database

### Quarterly
- Security audit
- Load testing
- User feedback review

## Rollback Plan

If deployment fails:

```bash
# Using Vercel
# Go to Deployments tab, click "Promote to Production" on previous version

# Using Docker
docker pull yourname/nototrack:previous-tag
docker stop nototrack
docker run -d --name nototrack ... yourname/nototrack:previous-tag
```

## Security Checklist

- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Environment variables not in git
- [ ] Supabase RLS policies enforced
- [ ] Auth tokens stored securely
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (if available)
- [ ] Regular security updates applied

## Support & Issues

### Common Issues

**Login fails**
- Verify email format: `{employee_id}@nototrack.co.za`
- Check Supabase Auth is enabled
- Verify user exists in database

**Offline mode not working**
- Check browser supports IndexedDB
- Clear browser cache
- Verify HTTPS in production

**Sync queue stuck**
- Check internet connection
- Verify Supabase is accessible
- Check RLS policies allow insert

### Debug Mode

Set in Vercel environment:

```
NODE_ENV=development
DEBUG=nototrack:*
```

Then check logs:
```bash
# Vercel
vercel logs

# Docker
docker logs -f container_id
```

---

**For issues**: Contact YMS × IDC technical team
**Last Updated**: 2026-03-20
