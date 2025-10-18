# Review & Rating API Documentation

## Overview
Comprehensive review system for novels with the following features:
- ⭐ **Rating System**: 1-5 star ratings
- 📝 **Reviews**: User comments with ratings
- ❤️ **Review Likes**: Users can like reviews
- 💬 **Replies**: Users can reply to reviews
- 📊 **Statistics**: Average ratings and rating distribution
- 🔒 **One Review Per User**: Each user can only review a novel once

## Models

### Review Model
```javascript
{
    user: ObjectId (ref: User),
    novel: ObjectId (ref: Novel),
    rating: Number (1-5, required),
    comment: String (required),
    likes: [ObjectId] (array of User IDs who liked),
    replies: [{
        user: ObjectId (ref: User),
        comment: String,
        createdAt: Date
    }],
    createdAt: Date,
    updatedAt: Date,
    // Virtuals
    likesCount: Number,
    repliesCount: Number
}
```

### Updated Novel Model
```javascript
{
    // existing fields...
    averageRating: Number (0-5, default: 0),
    totalReviews: Number (default: 0)
}
```

## API Endpoints

### 1. Add Review
**POST** `/api/review/novel/:novelId`

Add a review and rating for a novel. One review per user per novel.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{
    "rating": 5,
    "comment": "Amazing novel! The plot twists kept me engaged throughout."
}
```

**Response (201):**
```json
{
    "success": true,
    "message": "Review added successfully",
    "data": {
        "review": {
            "_id": "review_id",
            "user": {
                "_id": "user_id",
                "username": "john_doe",
                "profilePicture": "profile_url"
            },
            "novel": "novel_id",
            "rating": 5,
            "comment": "Amazing novel! The plot twists kept me engaged throughout.",
            "likes": [],
            "replies": [],
            "likesCount": 0,
            "repliesCount": 0,
            "createdAt": "2025-10-17T10:30:00.000Z",
            "updatedAt": "2025-10-17T10:30:00.000Z"
        },
        "novelStats": {
            "averageRating": 4.5,
            "totalReviews": 25,
            "distribution": {
                "1": 1,
                "2": 2,
                "3": 5,
                "4": 7,
                "5": 10
            }
        }
    }
}
```

**Error (400) - Already Reviewed:**
```json
{
    "success": false,
    "message": "You have already reviewed this novel. Use update endpoint to modify your review."
}
```

---

### 2. Get Novel Reviews
**GET** `/api/review/novel/:novelId?sortBy=recent&limit=20&page=1`

Get all reviews for a specific novel with pagination and sorting.

**Query Parameters:**
- `sortBy` (optional): `recent`, `oldest`, `highest`, `lowest`, `most-liked` (default: `recent`)
- `limit` (optional): Number of reviews per page (default: 20)
- `page` (optional): Page number (default: 1)

**Response:**
```json
{
    "success": true,
    "data": {
        "reviews": [
            {
                "_id": "review_id",
                "user": {
                    "_id": "user_id",
                    "username": "john_doe",
                    "profilePicture": "profile_url"
                },
                "novel": "novel_id",
                "rating": 5,
                "comment": "Excellent story!",
                "likes": ["user_id_1", "user_id_2"],
                "likesCount": 2,
                "replies": [
                    {
                        "user": {
                            "_id": "user_id_3",
                            "username": "jane_smith",
                            "profilePicture": "profile_url"
                        },
                        "comment": "I agree! Best novel I've read.",
                        "createdAt": "2025-10-17T11:00:00.000Z"
                    }
                ],
                "repliesCount": 1,
                "createdAt": "2025-10-17T10:30:00.000Z"
            }
        ],
        "stats": {
            "averageRating": 4.5,
            "totalReviews": 25,
            "distribution": {
                "1": 1,
                "2": 2,
                "3": 5,
                "4": 7,
                "5": 10
            }
        },
        "pagination": {
            "currentPage": 1,
            "totalPages": 2,
            "totalReviews": 25,
            "limit": 20
        }
    }
}
```

---

### 3. Update Review
**PUT** `/api/review/:reviewId`

Update your own review.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{
    "rating": 4,
    "comment": "Updated review: Still great but found some minor issues."
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Review updated successfully",
    "data": {
        "review": {
            "_id": "review_id",
            "rating": 4,
            "comment": "Updated review: Still great but found some minor issues.",
            "updatedAt": "2025-10-17T12:00:00.000Z"
        },
        "novelStats": {
            "averageRating": 4.4,
            "totalReviews": 25
        }
    }
}
```

---

### 4. Delete Review
**DELETE** `/api/review/:reviewId`

Delete your own review.

**Response (200):**
```json
{
    "success": true,
    "message": "Review deleted successfully",
    "data": {
        "novelStats": {
            "averageRating": 4.5,
            "totalReviews": 24
        }
    }
}
```

---

### 5. Toggle Review Like
**POST** `/api/review/:reviewId/like`

Like or unlike a review (toggle).

**Response (200) - Liked:**
```json
{
    "success": true,
    "message": "Review liked",
    "data": {
        "reviewId": "review_id",
        "liked": true,
        "likesCount": 15
    }
}
```

**Response (200) - Unliked:**
```json
{
    "success": true,
    "message": "Review unliked",
    "data": {
        "reviewId": "review_id",
        "liked": false,
        "likesCount": 14
    }
}
```

---

### 6. Add Reply to Review
**POST** `/api/review/:reviewId/reply`

Add a reply to a review.

**Body:**
```json
{
    "comment": "I totally agree with your review!"
}
```

**Response (201):**
```json
{
    "success": true,
    "message": "Reply added successfully",
    "data": {
        "reply": {
            "user": {
                "_id": "user_id",
                "username": "jane_smith",
                "profilePicture": "profile_url"
            },
            "comment": "I totally agree with your review!",
            "createdAt": "2025-10-17T13:00:00.000Z"
        }
    }
}
```

---

### 7. Get User's Review for Novel
**GET** `/api/review/user/novel/:novelId`

Check if the current user has reviewed a specific novel and get their review.

**Response (200) - Has Review:**
```json
{
    "success": true,
    "hasReviewed": true,
    "data": {
        "review": {
            "_id": "review_id",
            "rating": 5,
            "comment": "My review...",
            "likesCount": 3,
            "repliesCount": 1
        }
    }
}
```

**Response (404) - No Review:**
```json
{
    "success": false,
    "message": "Review not found",
    "hasReviewed": false
}
```

---

### 8. Get Novel Review Statistics
**GET** `/api/review/stats/novel/:novelId`

Get comprehensive statistics for a novel's reviews.

**Response:**
```json
{
    "success": true,
    "data": {
        "novelId": "novel_id",
        "title": "Novel Title",
        "averageRating": 4.5,
        "totalReviews": 25,
        "distribution": {
            "1": 1,
            "2": 2,
            "3": 5,
            "4": 7,
            "5": 10
        }
    }
}
```

---

## Frontend Integration Examples

### Add Review
```javascript
const addReview = async (novelId, rating, comment) => {
    try {
        const response = await fetch(`/api/review/novel/${novelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rating, comment })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Review added:', result.data.review);
            console.log('New average rating:', result.data.novelStats.averageRating);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### Get Reviews with Sorting
```javascript
const getReviews = async (novelId, sortBy = 'recent', page = 1) => {
    try {
        const response = await fetch(
            `/api/review/novel/${novelId}?sortBy=${sortBy}&limit=20&page=${page}`
        );
        const result = await response.json();
        
        if (result.success) {
            const { reviews, stats, pagination } = result.data;
            // Display reviews and stats
        }
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### Like a Review
```javascript
const toggleReviewLike = async (reviewId) => {
    try {
        const response = await fetch(`/api/review/${reviewId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(result.data.liked ? 'Liked!' : 'Unliked!');
            console.log('Total likes:', result.data.likesCount);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### Add Reply
```javascript
const addReply = async (reviewId, comment) => {
    try {
        const response = await fetch(`/api/review/${reviewId}/reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comment })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Reply added:', result.data.reply);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### Display Star Rating
```javascript
// Display star rating from 1-5
const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar) stars += '⭐'; // or use half-star icon
    
    return `${stars} ${rating.toFixed(1)}/5`;
};

// Example: "⭐⭐⭐⭐⭐ 4.5/5"
```

### Display Rating Distribution
```javascript
const renderDistribution = (distribution) => {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(distribution).reverse().map(([stars, count]) => {
        const percentage = (count / total * 100).toFixed(1);
        return `${stars}⭐: ${count} (${percentage}%)`;
    }).join('\n');
};
```

---

## Business Rules

1. **One Review Per User Per Novel**: Each user can only submit one review per novel
2. **Rating Range**: Ratings must be between 1 and 5 (inclusive)
3. **Update Own Reviews Only**: Users can only update/delete their own reviews
4. **Anyone Can Like**: Any authenticated user can like any review
5. **Anyone Can Reply**: Any authenticated user can reply to any review
6. **Auto-Update Stats**: Novel's average rating and total reviews automatically update on add/update/delete
7. **Rating Distribution**: System tracks how many of each rating (1-5) a novel has received

---

## Rating Calculation

The average rating is calculated as:
```javascript
averageRating = (sum of all ratings) / (total number of reviews)
```

Rounded to 1 decimal place (e.g., 4.7, 4.3)

---

## Sort Options Explained

- **recent**: Newest reviews first
- **oldest**: Oldest reviews first  
- **highest**: Highest rated reviews first (5★ first)
- **lowest**: Lowest rated reviews first (1★ first)
- **most-liked**: Reviews with most likes first

---

## Use Cases

### Display Novel Rating
```
⭐⭐⭐⭐⭐ 4.5 (125 reviews)

Rating Distribution:
5★: 65 reviews (52%)
4★: 40 reviews (32%)
3★: 15 reviews (12%)
2★: 3 reviews (2.4%)
1★: 2 reviews (1.6%)
```

### Review Card UI
```
[User Avatar] john_doe
⭐⭐⭐⭐⭐ 5/5
"Amazing novel! The plot twists kept me engaged..."

❤️ 15 likes  💬 3 replies  🕐 2 hours ago

[Like] [Reply]

Replies:
  [Avatar] jane_smith: "I agree! Best novel I've read."
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
    "success": false,
    "message": "Error description",
    "error": "Detailed error message (in development)"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request (validation error)
- `403`: Forbidden (not authorized)
- `404`: Not found
- `500`: Internal server error