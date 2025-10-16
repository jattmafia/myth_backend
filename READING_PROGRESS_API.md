# Reading Progress API Documentation

## Overview
This API allows you to track user's reading progress for chapters in your Flutter app, including scroll position and percentage read.

## Endpoints

### 1. Update Reading Progress
**Endpoint:** `PUT /api/chapter/progress/:chapterId`  
**Auth:** Required (JWT Token)

**Request Body:**
```json
{
  "scrollPosition": 1500,        // Current scroll position in pixels
  "progressPercent": 65,         // Reading progress (0-100)
  "totalContentHeight": 3000     // Total content height in pixels
}
```

**Response:**
```json
{
  "message": "Reading progress updated successfully",
  "progress": {
    "_id": "...",
    "user": "...",
    "chapter": "...",
    "novel": "...",
    "scrollPosition": 1500,
    "progressPercent": 65,
    "totalContentHeight": 3000,
    "isCompleted": false,
    "lastReadAt": "2025-10-16T10:30:00.000Z"
  }
}
```

### 2. Get Chapter Progress
**Endpoint:** `GET /api/chapter/progress/:chapterId`  
**Auth:** Required (JWT Token)

**Response:**
```json
{
  "_id": "...",
  "scrollPosition": 1500,
  "progressPercent": 65,
  "totalContentHeight": 3000,
  "isCompleted": false,
  "lastReadAt": "2025-10-16T10:30:00.000Z",
  "chapter": {
    "title": "Chapter 1",
    "chapterNumber": 1
  }
}
```

### 3. Get Novel Progress (All Chapters)
**Endpoint:** `GET /api/chapter/novel-progress/:novelId`  
**Auth:** Required (JWT Token)

**Response:**
```json
{
  "progressList": [
    {
      "scrollPosition": 3000,
      "progressPercent": 100,
      "isCompleted": true,
      "chapter": {
        "title": "Chapter 1",
        "chapterNumber": 1
      }
    },
    {
      "scrollPosition": 1500,
      "progressPercent": 50,
      "isCompleted": false,
      "chapter": {
        "title": "Chapter 2",
        "chapterNumber": 2
      }
    }
  ],
  "stats": {
    "totalChapters": 10,
    "completedChapters": 1,
    "overallProgress": 10
  }
}
```

### 4. Get Currently Reading Novels
**Endpoint:** `GET /api/chapter/currently-reading?page=1&limit=10`  
**Auth:** Required (JWT Token)

**Response:**
```json
{
  "currentlyReading": [
    {
      "novel": {
        "_id": "...",
        "title": "My Novel",
        "coverImage": "...",
        "author": {
          "username": "author_name",
          "profilePicture": "..."
        }
      },
      "lastReadChapter": {
        "title": "Chapter 5",
        "chapterNumber": 5
      },
      "progressPercent": 45,
      "lastReadAt": "2025-10-16T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalNovels": 15
  }
}
```

## Flutter Implementation Example

### 1. Track Scroll Progress in Flutter

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ChapterReadingScreen extends StatefulWidget {
  final String chapterId;
  
  const ChapterReadingScreen({required this.chapterId});

  @override
  State<ChapterReadingScreen> createState() => _ChapterReadingScreenState();
}

class _ChapterReadingScreenState extends State<ChapterReadingScreen> {
  final ScrollController _scrollController = ScrollController();
  double _progressPercent = 0.0;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadProgress();
  }

  void _onScroll() {
    // Cancel previous timer
    _debounceTimer?.cancel();
    
    // Calculate progress
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    
    if (maxScroll > 0) {
      setState(() {
        _progressPercent = (currentScroll / maxScroll * 100).clamp(0, 100);
      });
      
      // Debounce - update progress after user stops scrolling for 2 seconds
      _debounceTimer = Timer(Duration(seconds: 2), () {
        _updateProgress(
          scrollPosition: currentScroll,
          progressPercent: _progressPercent,
          totalContentHeight: maxScroll,
        );
      });
    }
  }

  Future<void> _loadProgress() async {
    final token = 'YOUR_JWT_TOKEN'; // Get from secure storage
    
    final response = await http.get(
      Uri.parse('http://localhost:3000/api/chapter/progress/${widget.chapterId}'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      
      // Restore scroll position
      if (data['scrollPosition'] != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _scrollController.jumpTo(data['scrollPosition'].toDouble());
        });
      }
      
      setState(() {
        _progressPercent = data['progressPercent']?.toDouble() ?? 0.0;
      });
    }
  }

  Future<void> _updateProgress({
    required double scrollPosition,
    required double progressPercent,
    required double totalContentHeight,
  }) async {
    final token = 'YOUR_JWT_TOKEN'; // Get from secure storage
    
    try {
      final response = await http.put(
        Uri.parse('http://localhost:3000/api/chapter/progress/${widget.chapterId}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'scrollPosition': scrollPosition,
          'progressPercent': progressPercent,
          'totalContentHeight': totalContentHeight,
        }),
      );

      if (response.statusCode == 200) {
        print('Progress updated successfully');
      }
    } catch (e) {
      print('Error updating progress: $e');
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Reading Chapter'),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: _progressPercent / 100,
            backgroundColor: Colors.grey[300],
            valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
          ),
        ),
      ),
      body: SingleChildScrollView(
        controller: _scrollController,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              // Your chapter content here
              Text('Chapter content...'),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 2. Show Currently Reading Novels

```dart
class CurrentlyReadingList extends StatelessWidget {
  Future<List<dynamic>> _fetchCurrentlyReading() async {
    final token = 'YOUR_JWT_TOKEN'; // Get from secure storage
    
    final response = await http.get(
      Uri.parse('http://localhost:3000/api/chapter/currently-reading?page=1&limit=10'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['currentlyReading'];
    }
    
    return [];
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: _fetchCurrentlyReading(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return CircularProgressIndicator();
        }

        return ListView.builder(
          itemCount: snapshot.data!.length,
          itemBuilder: (context, index) {
            final item = snapshot.data![index];
            final novel = item['novel'];
            final lastChapter = item['lastReadChapter'];
            final progress = item['progressPercent'];

            return Card(
              child: ListTile(
                leading: Image.network(novel['coverImage']),
                title: Text(novel['title']),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Last read: ${lastChapter['title']}'),
                    SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: progress / 100,
                    ),
                    Text('${progress.toStringAsFixed(0)}% complete'),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
```

## Notes for Flutter Implementation

1. **Debouncing**: Use a timer to debounce scroll updates (wait 1-2 seconds after scrolling stops before updating)
2. **Save on Exit**: Also update progress when user leaves the chapter screen
3. **Progress Calculation**: `progressPercent = (currentScrollPosition / maxScrollExtent) * 100`
4. **Auto-Complete**: Chapters are marked as completed when progress reaches 95%
5. **Restore Position**: Load progress when opening a chapter to restore scroll position
6. **Background Updates**: Consider using WorkManager or similar for periodic sync

## Features

- ✅ Track scroll position in pixels
- ✅ Track reading percentage (0-100)
- ✅ Auto-mark chapters as completed (≥95% progress)
- ✅ Resume reading from last position
- ✅ View all reading progress for a novel
- ✅ Get list of currently reading novels
- ✅ Last read timestamp tracking
