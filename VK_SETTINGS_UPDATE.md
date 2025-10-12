# VK Sources Settings Standardization

## Date: October 12, 2025

## Summary
Standardized all VK source monitoring settings to use consistent default values across all groups.

## Changes Made

### 1. Database Updates ✅
- **All 227 VK groups** now use standardized settings:
  - **Check Frequency**: 30 minutes (reduced from 60)
  - **Posts to Check**: 50 posts
- **36 groups** were updated to match the new standard
  - Most had incorrect `postsToCheck` values (25 or 60 instead of 50)

### 2. Model Defaults Updated ✅
File: `server/models/VkSource.js`
- Set `checkFrequency` default to **30 minutes** (was 60)
- Set `postsToCheck` default to **50 posts**

### 3. UI Simplified ✅

#### Form (SourceForm.js)
**Removed UI controls for:**
- ❌ Check Frequency (minutes) - now fixed at 30 min
- ❌ Posts to Check - now fixed at 50 posts
- ❌ Experimental View Tracking toggle
- ❌ All experimental features section
- ❌ Threshold Statistics display
- ❌ Advanced Threshold Calculator
- ❌ Statistical charts and detailed analytics

**Kept in form:**
- ✅ Source Name (VK group)
- ✅ Threshold Type (Auto/Manual)
- ✅ Manual Threshold value (for manual mode)
- ✅ Current Threshold display (for auto mode)
- ✅ Active toggle

#### List (SourcesList.js)
**Removed columns:**
- ❌ Check Frequency column
- ❌ Posts to Check column

**Kept in list:**
- ✅ Source Name
- ✅ Threshold (with Auto/Manual badge)
- ✅ Last Check
- ✅ Status (Active/Inactive)
- ✅ Actions (Calculate, Process, Edit, Delete)

### 4. Threshold Recalculation ✅
Recalculated thresholds for all 156 active VK groups:
- **150 groups** had threshold changes
- **Average increase**: 1.4%
- **Distribution**:
  - < 10K views: 10 groups (6.4%)
  - 10-20K: 25 groups (16.0%)
  - 20-50K: 80 groups (51.3%)
  - > 50K: 41 groups (26.3%)
- **Average threshold**: 40,372 views
- **Median threshold**: 32,512 views

### 5. Deployment ✅
- Changes committed to git
- Pushed to GitHub
- Server updated and restarted
- New settings are now live

## Result
✅ All VK groups now have **uniform monitoring parameters**
✅ Interface is **simplified** - no confusing options
✅ Settings are **optimized** for better viral post detection
✅ Thresholds are **up-to-date** and based on recent activity

## Configuration
All VK sources now automatically use:
- Monitoring frequency: **every 30 minutes**
- Analysis depth: **last 50 posts**
- Threshold calculation: **statistical (mean + 1.5×SD)** for auto mode

No manual configuration needed - the system uses optimal defaults.

## Code Cleanup
**Removed from frontend:**
- `ThresholdStats` component (127 lines)
- `AdvancedThresholdCalculator` component (230 lines)
- `formatNumber` helper function
- Unused MUI imports: Accordion, AccordionSummary, AccordionDetails, Card, CardContent, Grid, Slider, Alert, Tooltip, Table components
- Unused icons: ExpandMoreIcon, RefreshIcon, ShowChartIcon, SettingsIcon
- Unused Redux actions: calculateThresholdAdvanced, getThresholdStats
- Handler functions: handleCalculateThreshold, handleThresholdMethodChange

**Total code reduction:** ~480 lines removed from SourceForm.js
**Bundle size reduction:** ~10.6 KB (243 KB → 232 KB gzipped)

