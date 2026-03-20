# NotoTrack Testing Guide

Comprehensive testing procedures for NotoTrack PWA.

## Unit Testing Setup

### Install Testing Dependencies

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest @types/jest
```

### Configure Jest

Create `jest.config.js`:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
}

module.exports = createJestConfig(customJestConfig)
```

Create `jest.setup.js`:

```javascript
import '@testing-library/jest-dom'
```

## Manual Testing Scenarios

### Scenario 1: New User Registration & Login

**Steps**:
1. Navigate to login page
2. Try login with non-existent employee ID → See error
3. Try login with correct ID but wrong password → See error
4. Login with correct credentials (test-agent / YMS-A-P-001)
5. Redirected to dashboard

**Expected**:
- ✓ Error messages are clear
- ✓ Redirect works immediately
- ✓ User info displayed on dashboard

### Scenario 2: Complete Assessment While Online

**Setup**: Internet connected

**Steps**:
1. Click "Start New Assessment"
2. Fill each step:
   - Step 1: Shop name "Test Shop"
   - Step 2: Owner name "John Doe"
   - Step 3: Contact "0712345678"
   - Step 4: Capture GPS (mock location)
   - Step 5: Address "123 Main St"
   - Step 6-9: Answer yes/no questions
   - Step 10: Answer yes, add 5 staff
   - Step 11: Select "R20,001 - R50,000"
   - Step 12: Review and submit
3. See success message
4. Navigate to Submissions

**Expected**:
- ✓ All data saved to Supabase
- ✓ Status shows "✓ Synced" immediately
- ✓ Compliance score calculated (should be ~90)
- ✓ Submission appears in list

### Scenario 3: Complete Assessment While Offline

**Setup**: No internet connection

**Steps**:
1. Open DevTools → Network → Offline
2. Click "Start New Assessment"
3. Fill form completely
4. Submit
5. See "Pending Sync" status
6. Check dashboard shows pending count
7. Switch network back online
8. See auto-sync occur

**Expected**:
- ✓ Offline banner appears at top
- ✓ Form saves to IndexedDB
- ✓ Status shows "⟳ Pending"
- ✓ Pending count shown on dashboard
- ✓ Auto-syncs when online
- ✓ Status changes to "✓ Synced"

### Scenario 4: Partial Form Save & Exit

**Steps**:
1. Start assessment
2. Fill first 5 steps
3. Click "Save & Exit"
4. Redirected to dashboard
5. Open assessment again (or check IndexedDB)

**Expected**:
- ✓ Partial data persisted
- ✓ Can continue where left off
- ✓ No data loss

### Scenario 5: GPS Capture

**Steps**:
1. On step 4 (GPS)
2. Click "📍 Capture Location"
3. Grant location permission
4. See coordinates displayed

**Expected**:
- ✓ Coordinates appear (lat/lng)
- ✓ Format: decimal degrees (e.g., -29.881234, 30.876543)
- ✓ Auto-advances to next step

### Scenario 6: Role-Based Access

**Test Supervisor View**:
1. Login as supervisor (YMS-A-FS-001)
2. Dashboard should show different stats
3. Can see team members' submissions
4. Cannot access executive-only features

**Test Executive View**:
1. Login as executive (YMS-EXEC-001)
2. Dashboard shows all programme stats
3. Can view all submissions across workstream

**Expected**:
- ✓ Each role sees appropriate data
- ✓ Unauthorized access denied
- ✓ Middleware prevents direct URL access

### Scenario 7: Offline Queue Management

**Setup**: Save multiple assessments offline

**Steps**:
1. Turn off internet
2. Create 3 assessments
3. Check dashboard shows "3 pending"
4. Review submissions list shows all 3
5. Turn on internet
6. Watch auto-sync occur
7. Check Supabase database

**Expected**:
- ✓ Queue persists correctly
- ✓ Pending count accurate
- ✓ All items sync successfully
- ✓ No duplicates in database

### Scenario 8: PWA Installation (Mobile)

**Steps**:
1. Open on iOS: share → "Add to Home Screen"
2. Open on Android: menu → "Install app"
3. Launch installed app
4. Use offline
5. Sync when online

**Expected**:
- ✓ Icon appears on home screen
- ✓ App launches full-screen
- ✓ No browser UI visible
- ✓ Works offline
- ✓ Can sync data

### Scenario 9: Network Interruptions

**Setup**: Start assessment, interrupt network mid-form

**Steps**:
1. Start assessment
2. Fill steps 1-3
3. Disconnect network
4. Try to continue
5. Should gracefully handle offline mode
6. Save and exit
7. Reconnect
8. Verify data preserved

**Expected**:
- ✓ No crash or error
- ✓ Graceful degradation
- ✓ Data preserved locally
- ✓ Can resume on reconnect

### Scenario 10: Compliance Score Calculation

**Test Cases**:

**Tier 1 (80+)**:
- All yes: 25+20+20+20+10+5 = 100 ✓

**Tier 2 (60-79)**:
- No formal reg: 0+20+20+20+10+5 = 75 ✓

**Tier 3 (40-59)**:
- Only bank & staff: 20+10 = 30, add stock = 35 ✗
- CIPC + tax + bank + staff: 20+20+20+10 = 70 ✓

**Tier 4 (0-39)**:
- Only staff: 10 ✓
- No to everything: 0 ✓

**Expected**:
- ✓ Scores match expected ranges
- ✓ Tier classification correct
- ✓ Tier colours applied

### Scenario 11: Profile & Sign Out

**Steps**:
1. Navigate to profile
2. Verify all user info correct
3. Check pending sync count
4. Click "Sign Out"
5. Redirected to login
6. Cannot access dashboard directly

**Expected**:
- ✓ User info displayed correctly
- ✓ Pending count accurate
- ✓ Session cleared
- ✓ Middleware protects routes

### Scenario 12: Bottom Navigation

**Steps**:
1. On each page: Dashboard, Assessment, Submissions, Profile
2. Click each nav item
3. Verify active state highlights
4. Verify correct page loads

**Expected**:
- ✓ All links work
- ✓ Active item shows teal colour
- ✓ No navigation errors

## Performance Testing

### Metrics to Check

```bash
# Using Lighthouse in DevTools

# Desktop:
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 3s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 3s

# Mobile (4G):
- FCP: < 3s
- LCP: < 5s
- CLS: < 0.1
- TTI: < 4s
```

### Run Lighthouse

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Click "Analyze page load"
4. Target: Score > 85 on all metrics

## Accessibility Testing

### Checklist

- [ ] All buttons keyboard accessible (Tab key)
- [ ] Form inputs have labels
- [ ] Colour contrast meets WCAG AA
- [ ] Images have alt text
- [ ] Heading hierarchy correct (h1, h2, h3...)
- [ ] Error messages clear and associated with inputs
- [ ] Screen reader can navigate (use NVDA/JAWS)

### Quick Check

```javascript
// Run in browser console
document.querySelectorAll('img:not([alt])')  // Should be empty
document.querySelectorAll('button:not(:visible)')  // Check visibility
```

## Mobile Testing

### Devices to Test

- iPhone 12 (Safari)
- Samsung Galaxy S21 (Chrome)
- iPad (Safari)
- Pixel 4a (Chrome)

### Test On Real Devices

1. Get local IP: `ifconfig | grep inet`
2. On phone, navigate to `http://<your-ip>:3000`
3. Test forms, navigation, offline mode

### Viewport Sizes

Test responsiveness:
- 375px (small mobile)
- 414px (standard mobile)
- 768px (tablet)
- 1024px (desktop)

## Browser Compatibility

### Desktop Browsers

| Browser | Min Version | Status |
|---------|-------------|--------|
| Chrome | 90+ | ✓ Fully supported |
| Firefox | 88+ | ✓ Fully supported |
| Safari | 14+ | ✓ Fully supported |
| Edge | 90+ | ✓ Fully supported |

### Mobile Browsers

| Browser | Min Version | Status |
|---------|-------------|--------|
| Chrome Mobile | 90+ | ✓ Fully supported |
| Safari iOS | 14+ | ✓ PWA supported |
| Samsung Internet | 14+ | ✓ Fully supported |
| Firefox Mobile | 88+ | ✓ Fully supported |

## Automated Testing Example

Create `__tests__/compliance.test.ts`:

```typescript
import { calculateScore, getComplianceTier } from '@/lib/compliance';

describe('Compliance Scoring', () => {
  it('calculates 100 for all yes answers', () => {
    const score = calculateScore({
      is_registered: true,
      has_cipc: true,
      tax_compliant: true,
      has_bank_account: true,
      employs_staff: true,
      stock_value: 'Over R50,000',
    });
    expect(score).toBe(100);
  });

  it('calculates tier 1 for 100 score', () => {
    const tier = getComplianceTier(100);
    expect(tier.tier).toBe(1);
    expect(tier.label).toContain('NEF Eligible');
  });

  it('calculates tier 4 for 0 score', () => {
    const tier = getComplianceTier(0);
    expect(tier.tier).toBe(4);
    expect(tier.label).toContain('Critical');
  });
});
```

Run tests:

```bash
npm run test
```

## Regression Testing Checklist

After each update:

- [ ] Login/logout works
- [ ] All assessment steps functional
- [ ] Offline mode intact
- [ ] Sync queue working
- [ ] All roles accessible
- [ ] Database not corrupted
- [ ] No console errors
- [ ] Lighthouse score maintained

## Load Testing

### Simulate Multiple Users

```bash
npm install -D k6

# Create k6-load-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,  // 50 virtual users
  duration: '1m',
};

export default function () {
  const res = http.get('https://nototrack-demo.vercel.app/');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

Run:

```bash
k6 run k6-load-test.js
```

## Test Report Template

```markdown
# NotoTrack Test Report
Date: 2026-03-20
Tester: [Name]
Version: 1.0.0

## Results Summary
- Total Tests: 30
- Passed: 30
- Failed: 0
- Skipped: 0

## Issues Found
None

## Devices Tested
- iPhone 12 iOS 17
- Samsung Galaxy S21 Android 13
- Chrome Desktop 120

## Performance Metrics
- Lighthouse Score: 92
- Page Load Time: 1.8s
- Offline Mode: Working

## Sign-off
[Signature] [Date]
```

---

**Testing Frequency**: Run full test suite before each release
**Last Updated**: 2026-03-20
