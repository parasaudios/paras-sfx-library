# Sound Effect Suggestions - Visual Guide

## Admin Navigation Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Admin Dashboard    [Add Sounds] [Manage Sounds] [Search] [Suggestions 3] [Logout]  │
└─────────────────────────────────────────────────────────────────────────┘
                                                                      ↑
                                        Red badge shows unread count (3)
```

## Suggestions Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Sound Effect Suggestions                           Total Suggestions    │
│  Review and manage user suggestions...              3 unread / 5 total  │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ [New]  ✓ │  │ [New]  ✓ │  │ [New]  ✓ │  │ [Read] ○ │              │
│  │    🗑️    │  │    🗑️    │  │    🗑️    │  │    🗑️    │              │
│  │          │  │          │  │          │  │          │              │
│  │ SOUND    │  │ SOUND    │  │ SOUND    │  │ SOUND    │              │
│  │ EFFECT   │  │ EFFECT   │  │ EFFECT   │  │ EFFECT   │              │
│  │ Explosion│  │ Thunder  │  │ Door     │  │ Footsteps│              │
│  │          │  │          │  │ Creak    │  │          │              │
│  │ CATEGORY │  │ CATEGORY │  │          │  │ CATEGORY │              │
│  │ [Action] │  │ [Nature] │  │ CATEGORY │  │ [Foley]  │              │
│  │          │  │          │  │ [Horror] │  │          │              │
│  │ DETAILS  │  │ DETAILS  │  │          │  │ DETAILS  │              │
│  │ Large... │  │ Rumbling │  │ DETAILS  │  │ Walking  │              │
│  │          │  │ sound... │  │ Old wood │  │ on grass │              │
│  │          │  │          │  │ door...  │  │          │              │
│  │ Nov 22   │  │ Nov 22   │  │ Nov 21   │  │ Nov 20   │              │
│  │ 2:30 PM  │  │ 1:15 PM  │  │ 4:45 PM  │  │ 10:30 AM │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Card States

### Unread (New) Card
```
┌──────────────────────────────────┐
│ [New] 🟣              ✓    🗑️     │  ← Purple "New" badge, purple border
│                                  │
│ SOUND EFFECT                     │
│ Explosion                        │  ← White text, prominent
│                                  │
│ CATEGORY                         │
│ [Action] 🟣                      │  ← Purple outline badge
│                                  │
│ DETAILS                          │
│ Large cinematic explosion with   │  ← Light gray text
│ debris and rumble...             │
│                                  │
│ ────────────────────────────────│
│ Nov 22, 2025, 2:30 PM           │  ← Darker gray timestamp
└──────────────────────────────────┘
```

### Read Card
```
┌──────────────────────────────────┐
│ [Read] ⚫              ○    🗑️     │  ← Gray "Read" badge, gray border
│                   (60% opacity)   │
│ SOUND EFFECT                     │
│ Footsteps                        │  ← Slightly faded
│                                  │
│ CATEGORY                         │
│ [Foley] 🟣                       │
│                                  │
│ DETAILS                          │
│ Walking on grass with light      │
│ rustling...                      │
│                                  │
│ ────────────────────────────────│
│ Nov 20, 2025, 10:30 AM          │
└──────────────────────────────────┘
```

## Action Icons

**Mark as Read** (Unread cards)
- Icon: ✓ CheckCircle2 (green)
- Hover: Light background
- Action: Marks suggestion as read

**Mark as Unread** (Read cards)
- Icon: ○ Circle (gray)
- Hover: Light background
- Action: Marks suggestion as unread

**Delete**
- Icon: 🗑️ Trash2 (red)
- Hover: Red background tint
- Action: Permanently deletes suggestion

## Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Purple (`#9333EA`) | Primary | New badges, borders, category badges |
| Red (`#EF4444`) | Danger | Delete button, unread counter badge |
| Green (`#22C55E`) | Success | Mark as read icon |
| Gray (`#64748B`) | Neutral | Read badges, read cards, timestamps |
| White | Text | Primary text, headings |
| Slate-400 | Subtle | Labels, descriptions |
| Slate-500 | Muted | Timestamps |

## Responsive Breakpoints

- **Mobile (default)**: 1 column
- **Tablet (md)**: 2 columns
- **Desktop (xl)**: 4 columns

```
Mobile          Tablet           Desktop
┌──────┐        ┌────┐ ┌────┐   ┌──┐ ┌──┐ ┌──┐ ┌──┐
│      │        │    │ │    │   │  │ │  │ │  │ │  │
│      │        │    │ │    │   │  │ │  │ │  │ │  │
└──────┘        └────┘ └────┘   └──┘ └──┘ └──┘ └──┘
┌──────┐        ┌────┐ ┌────┐   
│      │        │    │ │    │   
│      │        │    │ │    │   
└──────┘        └────┘ └────┘   
```

## Sorting Logic

Suggestions are automatically sorted by:
1. **Unread first** - All unread suggestions appear before read ones
2. **Newest first** - Within each group, sorted by date (newest at top)

Example order:
1. Unread - Nov 22, 2025 (newest unread)
2. Unread - Nov 21, 2025
3. Unread - Nov 20, 2025
4. Read - Nov 19, 2025 (newest read)
5. Read - Nov 18, 2025

## Empty State

When no suggestions exist:
```
┌────────────────────────────────────────┐
│                                        │
│             No suggestions yet         │
│                                        │
│   When users submit sound effect       │
│   suggestions, they'll appear here     │
│                                        │
└────────────────────────────────────────┘
```

## Animation Effects

- **Card entrance**: Staggered fade-in from bottom (0.05s delay between cards)
- **Status change**: Smooth opacity and border color transitions
- **Delete**: Immediate removal with toast notification
- **Counter update**: Real-time updates (polls every 1 second)

## Toast Notifications

- **Suggestion submitted**: "Thank you for your suggestion!"
- **Status updated**: "Suggestion status updated"
- **Deleted**: "Suggestion deleted"
