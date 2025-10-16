# Updated API Response with Reading Progress

## 1. Get Novel by ID (WITH Reading Progress for Each Chapter)

**Endpoint:** `GET /api/novel/getNovelById/:novelId`  
**Auth:** Optional (if logged in, reading progress will be included)

### Response Example:

```json
{
  "_id": "novel123",
  "title": "My Amazing Novel",
  "description": "A great story about...",
  "hookupDescription": "Hook description...",
  "coverImage": "novel-pictures/123456-cover.jpg",
  "language": "English",
  "status": "published",
  "author": {
    "_id": "user123",
    "username": "author_name",
    "profilePicture": "...",
    "email": "author@example.com"
  },
  "chapters": [
    {
      "_id": "chapter1",
      "title": "Chapter 1: The Beginning",
      "chapterNumber": 1,
      "coverImage": "novel-chapters/...",
      "content": "Chapter content here...",
      "authorMessage": "Hope you enjoy!",
      "status": "published",
      "author": {
        "_id": "user123",
        "username": "author_name",
        "profilePicture": "..."
      },
      "createdAt": "2025-10-01T10:00:00.000Z",
      "updatedAt": "2025-10-01T10:00:00.000Z",
      "readingProgress": {
        "scrollPosition": 1500,
        "progressPercent": 65,
        "isCompleted": false,
        "lastReadAt": "2025-10-16T12:30:00.000Z"
      }
    },
    {
      "_id": "chapter2",
      "title": "Chapter 2: The Journey",
      "chapterNumber": 2,
      "coverImage": "novel-chapters/...",
      "content": "Chapter 2 content...",
      "status": "published",
      "author": {
        "_id": "user123",
        "username": "author_name"
      },
      "readingProgress": {
        "scrollPosition": 3000,
        "progressPercent": 100,
        "isCompleted": true,
        "lastReadAt": "2025-10-15T14:20:00.000Z"
      }
    },
    {
      "_id": "chapter3",
      "title": "Chapter 3: Not Started",
      "chapterNumber": 3,
      "status": "published",
      "readingProgress": {
        "scrollPosition": 0,
        "progressPercent": 0,
        "isCompleted": false,
        "lastReadAt": null
      }
    }
  ],
  "userProgress": {
    "overallProgress": 33,
    "completedChapters": 1,
    "totalChapters": 3
  },
  "createdAt": "2025-09-01T10:00:00.000Z",
  "updatedAt": "2025-10-16T12:30:00.000Z"
}
```

### Key Features:

1. **Each chapter includes `readingProgress`** object with:
   - `scrollPosition`: Last scroll position in pixels
   - `progressPercent`: Reading progress (0-100)
   - `isCompleted`: Auto-marked true when progress ≥ 95%
   - `lastReadAt`: Last time user read this chapter

2. **Novel includes `userProgress`** summary:
   - `overallProgress`: Overall reading progress percentage for the novel
   - `completedChapters`: Number of completed chapters
   - `totalChapters`: Total number of chapters

3. **Works for both logged-in and guest users**:
   - Logged-in users get their reading progress
   - Guest users get default progress (all 0s)

---

## 2. Get Chapter by ID (WITH Reading Progress)

**Endpoint:** `GET /api/chapter/getChapter/:chapterId`  
**Auth:** Optional (if logged in, reading progress will be included)

### Response Example:

```json
{
  "_id": "chapter1",
  "title": "Chapter 1: The Beginning",
  "chapterNumber": 1,
  "coverImage": "novel-chapters/...",
  "content": "<p>Full chapter content here...</p>",
  "authorMessage": "Hope you enjoy this chapter!",
  "status": "published",
  "novel": {
    "_id": "novel123",
    "title": "My Amazing Novel"
  },
  "author": {
    "_id": "user123",
    "username": "author_name",
    "profilePicture": "..."
  },
  "createdAt": "2025-10-01T10:00:00.000Z",
  "updatedAt": "2025-10-01T10:00:00.000Z",
  "readingProgress": {
    "scrollPosition": 1500,
    "progressPercent": 65,
    "isCompleted": false,
    "lastReadAt": "2025-10-16T12:30:00.000Z"
  }
}
```

---

## Flutter Implementation Example

### Opening a Novel (Get All Chapters with Progress)

```dart
class NovelDetailScreen extends StatelessWidget {
  final String novelId;

  Future<Map<String, dynamic>> _fetchNovel() async {
    final token = await getToken(); // Get JWT token
    
    final response = await http.get(
      Uri.parse('$baseUrl/api/novel/getNovelById/$novelId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load novel');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _fetchNovel(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return CircularProgressIndicator();
        }

        final novel = snapshot.data!;
        final chapters = novel['chapters'] as List;
        final userProgress = novel['userProgress'];

        return Scaffold(
          appBar: AppBar(title: Text(novel['title'])),
          body: Column(
            children: [
              // Overall Progress Card
              Card(
                margin: EdgeInsets.all(16),
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text('Your Progress'),
                      SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: userProgress['overallProgress'] / 100,
                      ),
                      SizedBox(height: 8),
                      Text(
                        '${userProgress['overallProgress']}% Complete',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${userProgress['completedChapters']} of ${userProgress['totalChapters']} chapters',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),

              // Chapter List
              Expanded(
                child: ListView.builder(
                  itemCount: chapters.length,
                  itemBuilder: (context, index) {
                    final chapter = chapters[index];
                    final progress = chapter['readingProgress'];

                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: progress['isCompleted'] 
                            ? Colors.green 
                            : Colors.grey,
                        child: Text('${chapter['chapterNumber']}'),
                      ),
                      title: Text(chapter['title']),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(height: 4),
                          LinearProgressIndicator(
                            value: progress['progressPercent'] / 100,
                          ),
                          SizedBox(height: 2),
                          Text(
                            progress['progressPercent'] > 0
                                ? '${progress['progressPercent']}% read'
                                : 'Not started',
                            style: TextStyle(fontSize: 12),
                          ),
                        ],
                      ),
                      trailing: progress['isCompleted']
                          ? Icon(Icons.check_circle, color: Colors.green)
                          : null,
                      onTap: () {
                        // Navigate to chapter reading screen
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChapterReadingScreen(
                              chapterId: chapter['_id'],
                              chapterTitle: chapter['title'],
                              content: chapter['content'],
                              initialProgress: progress['progressPercent'],
                              initialScrollPosition: progress['scrollPosition'],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
```

### Opening a Chapter (Get Chapter with Progress)

```dart
class ChapterReadingScreen extends StatefulWidget {
  final String chapterId;
  final String chapterTitle;
  final String content;
  final int initialProgress;
  final double initialScrollPosition;

  const ChapterReadingScreen({
    required this.chapterId,
    required this.chapterTitle,
    required this.content,
    this.initialProgress = 0,
    this.initialScrollPosition = 0,
  });

  @override
  State<ChapterReadingScreen> createState() => _ChapterReadingScreenState();
}

class _ChapterReadingScreenState extends State<ChapterReadingScreen> {
  final ScrollController _scrollController = ScrollController();
  late double _progressPercent;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _progressPercent = widget.initialProgress.toDouble();
    
    // Restore scroll position after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients && widget.initialScrollPosition > 0) {
        _scrollController.jumpTo(widget.initialScrollPosition);
      }
    });
    
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    
    if (maxScroll > 0) {
      final percent = ((currentScroll / maxScroll) * 100).clamp(0.0, 100.0);
      
      setState(() {
        _progressPercent = percent;
      });
      
      _debounceTimer?.cancel();
      _debounceTimer = Timer(Duration(seconds: 2), () {
        _updateProgress(currentScroll, percent);
      });
    }
  }

  Future<void> _updateProgress(double scrollPos, double percent) async {
    final token = await getToken();
    
    await http.put(
      Uri.parse('$baseUrl/api/chapter/progress/${widget.chapterId}'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'scrollPosition': scrollPos,
        'progressPercent': percent.round(),
      }),
    );
  }

  @override
  void dispose() {
    _updateProgress(_scrollController.position.pixels, _progressPercent);
    _debounceTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.chapterTitle),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(8),
          child: Column(
            children: [
              LinearProgressIndicator(
                value: _progressPercent / 100,
              ),
              Padding(
                padding: EdgeInsets.all(8),
                child: Text('${_progressPercent.round()}% Complete'),
              ),
            ],
          ),
        ),
      ),
      body: SingleChildScrollView(
        controller: _scrollController,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Html(data: widget.content), // Using flutter_html package
        ),
      ),
    );
  }
}
```

---

## Benefits of This Approach

### ✅ Pros:
1. **Single API Call** - Get novel + all chapters + all progress in one request
2. **Better Performance** - No need to make separate API calls for each chapter's progress
3. **Cleaner Code** - All data available immediately
4. **Real-time Progress** - See which chapters are completed, in-progress, or not started
5. **Better UX** - Show overall novel progress instantly

### 🎯 Use Cases:
- **Novel Details Screen**: Show all chapters with their progress
- **Continue Reading**: Jump to last read chapter
- **Progress Tracking**: Visual indicators for completed/in-progress chapters
- **Achievements**: Track when novel is 100% complete

---

## API Endpoints Summary

| Endpoint | Returns Reading Progress? | Notes |
|----------|-------------------------|-------|
| `GET /api/novel/getNovelById/:novelId` | ✅ Yes (for all chapters) | Returns novel with chapters array, each chapter has `readingProgress` |
| `GET /api/chapter/getChapter/:chapterId` | ✅ Yes (for this chapter) | Returns chapter with `readingProgress` object |
| `PUT /api/chapter/progress/:chapterId` | ✅ Yes (updates and returns) | Update reading progress |
| `GET /api/chapter/novel-progress/:novelId` | ✅ Yes (all chapters) | Detailed progress list (old endpoint, still works) |
| `GET /api/chapter/currently-reading` | ✅ Yes | List of novels being read |

---

## Migration Notes

### Old Way (Multiple API Calls):
```dart
// 1. Get novel
final novel = await fetchNovel(novelId);

// 2. Get progress for each chapter (N API calls!)
for (var chapter in novel.chapters) {
  final progress = await fetchChapterProgress(chapter.id);
  chapter.progress = progress;
}
```

### New Way (Single API Call):
```dart
// 1. Get novel with all progress included
final novel = await fetchNovel(novelId);

// Progress is already included!
for (var chapter in novel['chapters']) {
  print(chapter['readingProgress']); // Already available!
}
```

**Performance Improvement**: From `1 + N API calls` → `1 API call` 🚀
