# Chapter Access Status in getNovelById API

## Response Structure

Each chapter in the `chapters` array now includes access information:

```json
{
  "_id": "chapter_id",
  "title": "Chapter Title",
  "chapterNumber": 1,
  "createdAt": "2024-10-30T00:00:00Z",
  "viewCount": 100,
  "coverImage": "image_url",
  "readingProgress": {
    "scrollPosition": 0,
    "progressPercent": 0,
    "isCompleted": false,
    "lastReadAt": null
  },
  "isLocked": false,
  "canAccess": true,
  "accessType": "free"
}
```

## Access Status Details

### For FREE Novels:
- **All chapters**: `isLocked: false`, `canAccess: true`, `accessType: "free"`

### For PAID Novels:

#### Chapters 1-5 (Free Chapters):
- `isLocked: false`
- `canAccess: true`
- `accessType: "free"`

#### Chapters 6+ (Paid/Locked Chapters):

**If NOT logged in:**
- `isLocked: true`
- `canAccess: false`
- `accessType: "locked"`
- `requiresLogin: true`

**If logged in but NOT purchased:**
- `isLocked: true`
- `canAccess: false`
- `accessType: "locked"`
- `requiresPurchase: true`

**If logged in and PURCHASED:**
- `isLocked: false`
- `canAccess: true`
- `accessType: "purchased"`

## Example Response

### Free Novel Response:
```json
{
  "chapters": [
    {
      "_id": "ch1",
      "title": "Chapter 1",
      "chapterNumber": 1,
      "isLocked": false,
      "canAccess": true,
      "accessType": "free"
    },
    {
      "_id": "ch2",
      "title": "Chapter 2",
      "chapterNumber": 2,
      "isLocked": false,
      "canAccess": true,
      "accessType": "free"
    }
  ]
}
```

### Paid Novel Response (Not Logged In):
```json
{
  "chapters": [
    {
      "_id": "ch1",
      "title": "Chapter 1",
      "chapterNumber": 1,
      "isLocked": false,
      "canAccess": true,
      "accessType": "free"
    },
    {
      "_id": "ch6",
      "title": "Chapter 6",
      "chapterNumber": 6,
      "isLocked": true,
      "canAccess": false,
      "accessType": "locked",
      "requiresLogin": true
    }
  ]
}
```

### Paid Novel Response (Logged In, Some Purchased):
```json
{
  "chapters": [
    {
      "_id": "ch1",
      "title": "Chapter 1",
      "chapterNumber": 1,
      "isLocked": false,
      "canAccess": true,
      "accessType": "free"
    },
    {
      "_id": "ch6",
      "title": "Chapter 6",
      "chapterNumber": 6,
      "isLocked": false,
      "canAccess": true,
      "accessType": "purchased"
    },
    {
      "_id": "ch7",
      "title": "Chapter 7",
      "chapterNumber": 7,
      "isLocked": true,
      "canAccess": false,
      "accessType": "locked",
      "requiresPurchase": true
    }
  ]
}
```

## Frontend Usage

Frontend can use the `isLocked` or `canAccess` boolean to:
- Show a lock icon on locked chapters
- Disable reading for locked chapters
- Show a "Purchase" button for `requiresPurchase: true`
- Show a "Login" button for `requiresLogin: true`
- Show the `accessType` label (Free, Purchased, Locked)
