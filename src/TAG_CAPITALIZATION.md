# Tag Capitalization System

## Overview
All tags displayed throughout the website have their first letter capitalized for a professional appearance. The "nsfw" tag is special-cased to always display as "NSFW" (all uppercase).

## Implementation

### Core Function
**File:** `/utils/tagUtils.ts`

```typescript
export function formatTagForDisplay(tag: string): string {
  // NSFW should always be uppercase
  if (tag.toLowerCase() === 'nsfw') {
    return 'NSFW';
  }
  
  // Capitalize first letter of the tag
  if (!tag) return tag;
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
}
```

## Display Examples

### Regular Tags
- **Stored:** `"horror"` → **Displayed:** `"Horror"`
- **Stored:** `"ambient"` → **Displayed:** `"Ambient"`
- **Stored:** `"cinematic"` → **Displayed:** `"Cinematic"`
- **Stored:** `"door"` → **Displayed:** `"Door"`
- **Stored:** `"scream"` → **Displayed:** `"Scream"`

### NSFW Tag
- **Stored:** `"nsfw"` → **Displayed:** `"NSFW"`
- **Stored:** `"NSFW"` → **Displayed:** `"NSFW"`
- **Stored:** `"Nsfw"` → **Displayed:** `"NSFW"`

### Multiple Tags Example
**Stored in Database:**
```json
["horror", "nsfw", "scream", "ambient"]
```

**Displayed on Website:**
```
Horror | NSFW | Scream | Ambient
```

## Where It's Applied

### 1. **Search Results** (Main Page)
When users search for sounds, all tags in the results are properly capitalized.

**Component:** `GoogleDriveAudioPlayer`
```tsx
{tags.map((tag, index) => (
  <span className="...">
    {formatTagForDisplay(tag)}
  </span>
))}
```

### 2. **Browse By Tag Section**
All tag buttons show capitalized tags.

**Component:** `BrowseByTags`
```tsx
<motion.button>
  {tag === 'all sounds' ? capitalizeWords(tag) : formatTagForDisplay(tag)}
</motion.button>
```

**Display:**
```
[Horror] [NSFW] [Ambient] [Door]
```

### 3. **Admin - Manage Sounds**
Tags in the sound management interface are capitalized.

**Component:** `ManageSounds`
```tsx
{sound.tags.map((tag, index) => (
  <span className="...">
    {formatTagForDisplay(tag)}
  </span>
))}
```

### 4. **Admin - Manage Tags**
Both available tags and current tags show with proper capitalization.

**Component:** `ManageTags`
```tsx
<span>{formatTagForDisplay(tag)}</span>
```

**Display:**
```
Available Tags: Horror, Ambient, Cinematic
Current Tags: Door, NSFW, Scream
```

### 5. **Audio Player Component**
Legacy audio player component also shows capitalized tags.

**Component:** `AudioPlayer`
```tsx
{tags.slice(0, 3).map((tag) => (
  <span className="...">
    {formatTagForDisplay(tag)}
  </span>
))}
```

### 6. **Admin Search Results**
Search results in the admin panel show capitalized tags.

**Component:** `SearchSounds` → passes to `GoogleDriveAudioPlayer`

## Technical Details

### Data Storage
- Tags are stored in the database **as-is** (usually lowercase)
- No modification to database data
- Capitalization only happens at display time

### Case Insensitive Features
These features still work regardless of capitalization:

1. **Search** - Searches work with any case
2. **Age Verification** - NSFW detection is case-insensitive
3. **Tag Filtering** - Filtering works with any case

### Performance
- ✅ Lightweight function (simple string manipulation)
- ✅ No performance impact
- ✅ Applied at render time only

## Component Integration

### Updated Components
1. ✅ `/components/GoogleDriveAudioPlayer.tsx`
2. ✅ `/components/AudioPlayer.tsx`
3. ✅ `/components/BrowseByTags.tsx`
4. ✅ `/components/ManageSounds.tsx`
5. ✅ `/components/ManageTags.tsx`

### Import Pattern
All components use the same import:
```typescript
import { formatTagForDisplay } from '../utils/tagUtils';
```

## Complete Examples

### Example 1: Horror Sound
**Database:**
```json
{
  "title": "Creepy Door",
  "tags": ["horror", "door", "creaky"]
}
```

**Main Page Display:**
```
Title: Creepy Door
Tags: Horror | Door | Creaky
```

### Example 2: NSFW Sound
**Database:**
```json
{
  "title": "Adult Scream",
  "tags": ["nsfw", "scream", "adult"]
}
```

**Main Page Display:**
```
Title: Adult Scream
Tags: NSFW | Scream | Adult
```

### Example 3: Browse By Tags
**Managed Tags:**
```json
["horror", "ambient", "nsfw", "cinematic", "door"]
```

**Browse Section Display:**
```
┌─────────┐ ┌─────────┐ ┌──────┐ ┌───────────┐ ┌──────┐
│ Horror  │ │ Ambient │ │ NSFW │ │ Cinematic │ │ Door │
└─────────┘ └─────────┘ └──────┘ └───────────┘ └──────┘
```

### Example 4: Admin Sound Management
**Sound List:**
```
Sound #1: Creepy Ambience
Tags: Horror | Ambient | Dark

Sound #2: Intense Scene
Tags: Cinematic | NSFW | Dramatic

Sound #3: Door Slam
Tags: Door | Impact | Wood
```

## Benefits

### 1. **Professional Appearance**
- ✅ Consistent capitalization across all pages
- ✅ Clean, polished look
- ✅ Easier to read

### 2. **NSFW Visibility**
- ✅ NSFW stands out immediately
- ✅ Clear content warning
- ✅ All-caps draws attention

### 3. **User Experience**
- ✅ Tags are easier to scan
- ✅ Professional presentation
- ✅ Consistent with UI standards

### 4. **Backward Compatible**
- ✅ Works with existing data
- ✅ No database migration needed
- ✅ Display-only transformation

## Testing

### Test Cases

✅ **Test 1: Regular Tags**
- Input: `["horror", "ambient"]`
- Output: `"Horror | Ambient"`

✅ **Test 2: NSFW Tag**
- Input: `["nsfw", "scream"]`
- Output: `"NSFW | Scream"`

✅ **Test 3: Mixed Case Input**
- Input: `["Horror", "AMBIENT", "door"]`
- Output: `"Horror | Ambient | Door"`

✅ **Test 4: Browse By Tags**
- Managed tags display with first letter capitalized
- NSFW displays as all caps

✅ **Test 5: Admin Panel**
- All sound tags show capitalized
- Tag management shows capitalized tags

✅ **Test 6: Search Results**
- All search results show capitalized tags
- Consistent across main page and admin search

## Maintenance

### Adding New Components
If creating a new component that displays tags:

1. Import the utility function:
```typescript
import { formatTagForDisplay } from '../utils/tagUtils';
```

2. Use it when rendering tags:
```tsx
{tags.map(tag => (
  <span>{formatTagForDisplay(tag)}</span>
))}
```

### Modifying Tag Display Logic
All tag display logic is centralized in `/utils/tagUtils.ts`. Update this file to change how tags appear throughout the app.

## Special Cases

### "all sounds" Tag
The "all sounds" tag in BrowseByTags is handled separately with `capitalizeWords()` to maintain "All Sounds" capitalization (both words capitalized).

### Multi-word Tags (Future)
Current implementation capitalizes only the first letter. If multi-word tags are added in the future (e.g., "sci fi"), consider:

```typescript
// Future enhancement
export function formatTagForDisplay(tag: string): string {
  if (tag.toLowerCase() === 'nsfw') return 'NSFW';
  
  // Capitalize first letter of each word
  return tag
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

## Summary

✅ **All tags** have their first letter capitalized  
✅ **NSFW tag** is always displayed in all uppercase  
✅ **Consistent** across all pages and components  
✅ **Display-only** - no database changes  
✅ **Backward compatible** with existing data  
✅ **Professional** appearance throughout the site  

The tag capitalization system ensures a polished, professional look across the entire Para's SFX Library application.
