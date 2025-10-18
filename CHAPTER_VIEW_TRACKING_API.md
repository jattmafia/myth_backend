# Chapter View Tracking API

## Overview
This system implements chapter-based view tracking with the following rules:
- 1 view per user per chapter allowed every 24 hours
- Views are account-based (not IP-based)
- Novel's total views = Sum of all unique chapter views
- Each chapter maintains its own view counter
- 24-hour cooldown period to prevent spam

## Models

### ChapterView Model
```javascript
{
    user: ObjectId (ref: User),
    chapter: ObjectId (ref: Chapter),
    novel: ObjectId (ref: Novel),
    viewedAt: Date,
    ipAddress: String,
    userAgent: String
}
```

### Updated Chapter Model
```javascript
{
    // existing fields...
    viewCount: Number (default: 0)
}
```

### Updated Novel Model
```javascript
{
    // existing fields...
    totalViews: Number (default: 0)
}
```

## API Endpoints

### 1. Record Chapter View
**POST** `/api/novel/view/chapter/:chapterId`

Records a view for a specific chapter. Only one view per user per chapter is allowed within 24 hours.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response Success (201):**
```json
{
    "success": true,
    "message": "Chapter view recorded successfully",
    "data": {
        "chapterId": "chapter_id",
        "novelId": "novel_id",
        "chapterViewCount": 150,
        "novelViewCount": 1250,
        "viewedAt": "2025-10-17T10:30:00.000Z"
    }
}
```

**Response Already Viewed (200):**
```json
{
    "success": false,
    "message": "Chapter view already recorded within 24 hours",
    "alreadyViewed": true,
    "data": {
        "chapterId": "chapter_id",
        "novelId": "novel_id"
    }
}
```

### 2. Get Chapter View Statistics
**GET** `/api/novel/view/chapter/:chapterId/stats?timeframe=24h`

Gets view statistics for a specific chapter.

**Query Parameters:**
- `timeframe` (optional): `24h`, `7d`, `30d`, or omit for all-time

**Response:**
```json
{
    "success": true,
    "data": {
        "chapterId": "chapter_id",
        "viewCount": 150,
        "timeframe": "24h"
    }
}
```

### 3. Get Novel View Statistics
**GET** `/api/novel/view/novel/:novelId/stats?timeframe=7d`

Gets comprehensive view statistics for a novel and all its chapters.

**Response:**
```json
{
    "success": true,
    "data": {
        "novelId": "novel_id",
        "totalViews": 1250,
        "timeframe": "7d",
        "chapters": [
            {
                "chapterId": "chapter1_id",
                "title": "Chapter 1: Beginning",
                "chapterNumber": 1,
                "viewCount": 45,
                "totalViewCount": 200
            },
            {
                "chapterId": "chapter2_id",
                "title": "Chapter 2: Journey",
                "chapterNumber": 2,
                "viewCount": 38,
                "totalViewCount": 180
            }
        ]
    }
}
```

### 4. Get User's Recently Viewed Chapters
**GET** `/api/novel/view/recently-viewed?limit=10`

Gets the user's recently viewed chapters.

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)

**Response:**
```json
{
    "success": true,
    "data": {
        "recentlyViewed": [
            {
                "_id": "view_id",
                "chapter": {
                    "_id": "chapter_id",
                    "title": "Chapter 5: The Revelation",
                    "chapterNumber": 5
                },
                "novel": {
                    "_id": "novel_id",
                    "title": "Epic Fantasy Novel",
                    "coverImage": "cover_url",
                    "author": "author_id"
                },
                "viewedAt": "2025-10-17T10:30:00.000Z"
            }
        ],
        "total": 1
    }
}
```

## How It Works

### View Recording Flow
1. User opens a chapter → Frontend calls `POST /api/novel/view/chapter/:chapterId`
2. System checks if user has viewed this chapter in the last 24 hours
3. If no recent view exists:
   - Creates new ChapterView record
   - Increments chapter's `viewCount` by 1
   - Increments novel's `totalViews` by 1
   - Returns success with updated counts
4. If recent view exists:
   - Returns "already viewed" response
   - No counters are incremented

### View Counting Logic
- **Chapter Views**: Each chapter tracks its own view count
- **Novel Views**: Sum of all chapter view counts for that novel
- **24-Hour Rule**: Same user cannot generate multiple views for the same chapter within 24 hours
- **Automatic Sync**: When a chapter gets a view, the novel's total automatically increases

### Example Scenario
User reads a 10-chapter novel over 3 days:

**Day 1:** Reads chapters 1-3
- Chapter 1: +1 view
- Chapter 2: +1 view  
- Chapter 3: +1 view
- Novel total: +3 views

**Day 2:** Reads chapters 4-6, re-opens chapter 2
- Chapter 4: +1 view
- Chapter 5: +1 view
- Chapter 6: +1 view
- Chapter 2: No new view (24-hour cooldown)
- Novel total: +3 more views (total: 6)

**Day 3:** Finishes chapters 7-10
- Chapters 7-10: +4 views each
- Novel total: +4 more views (total: 10)

## Frontend Integration

### Recording Views
```javascript
// Call when user opens/starts reading a chapter
const recordView = async (chapterId) => {
    try {
        const response = await fetch(`/api/novel/view/chapter/${chapterId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('View recorded:', result.data);
            // Update UI with new view counts
        } else if (result.alreadyViewed) {
            console.log('Already viewed within 24h');
            // Don't show view increment animation
        }
    } catch (error) {
        console.error('Error recording view:', error);
    }
};
```

### Getting Statistics
```javascript
// Get novel statistics for display
const getNovelStats = async (novelId) => {
    try {
        const response = await fetch(`/api/novel/view/novel/${novelId}/stats?timeframe=7d`);
        const result = await response.json();
        
        if (result.success) {
            const { totalViews, chapters } = result.data;
            // Display statistics in UI
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
};
```

## Database Considerations

### Indexes
- `{ user: 1, chapter: 1 }` - For checking 24-hour cooldown
- `{ chapter: 1, viewedAt: -1 }` - For chapter statistics
- `{ novel: 1, viewedAt: -1 }` - For novel statistics
- `{ viewedAt: 1 }` - For general queries and cleanup

### Data Retention
Consider implementing data cleanup for old view records if storage becomes an issue:

```javascript
// Optional: Cleanup views older than 1 year
db.chapterviews.deleteMany({
    viewedAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
});
```

The `viewCount` and `totalViews` fields in Chapter and Novel models will persist the counts even after cleaning up old view records.