# Flutter Reading Progress Implementation Guide

## How ScrollController Works

In Flutter, the `ScrollController` automatically gives you all the information you need:

- `maxScrollExtent` - Total scrollable height (like totalContentHeight)
- `pixels` - Current scroll position
- Progress = (current position / max extent) × 100

You **don't need to calculate or send totalContentHeight manually** - Flutter does it for you!

## Complete Flutter Implementation

### 1. Basic Chapter Reading Screen

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

class ChapterReadingScreen extends StatefulWidget {
  final String chapterId;
  final String chapterTitle;
  final String content;

  const ChapterReadingScreen({
    Key? key,
    required this.chapterId,
    required this.chapterTitle,
    required this.content,
  }) : super(key: key);

  @override
  State<ChapterReadingScreen> createState() => _ChapterReadingScreenState();
}

class _ChapterReadingScreenState extends State<ChapterReadingScreen> {
  final ScrollController _scrollController = ScrollController();
  double _progressPercent = 0.0;
  Timer? _debounceTimer;
  Timer? _periodicTimer;
  bool _isLoading = true;
  
  final String baseUrl = 'http://localhost:3000'; // Change to your API URL
  String? _token; // Store your JWT token

  @override
  void initState() {
    super.initState();
    _initializeReading();
  }

  Future<void> _initializeReading() async {
    // Get token from secure storage
    _token = await _getToken();
    
    // Load saved progress
    await _loadProgress();
    
    // Add scroll listener
    _scrollController.addListener(_onScroll);
    
    // Set periodic save (every 30 seconds while reading)
    _periodicTimer = Timer.periodic(Duration(seconds: 30), (_) {
      if (_scrollController.hasClients) {
        _saveProgress();
      }
    });
    
    setState(() {
      _isLoading = false;
    });
  }

  Future<String?> _getToken() async {
    // TODO: Get from secure storage (flutter_secure_storage)
    // final storage = FlutterSecureStorage();
    // return await storage.read(key: 'jwt_token');
    return 'YOUR_JWT_TOKEN_HERE';
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    
    // Get scroll information
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.position.pixels;
    
    // Calculate progress percentage
    if (maxScroll > 0) {
      final percent = ((currentScroll / maxScroll) * 100).clamp(0.0, 100.0);
      
      setState(() {
        _progressPercent = percent;
      });
      
      // Debounce: Save after user stops scrolling for 2 seconds
      _debounceTimer?.cancel();
      _debounceTimer = Timer(Duration(seconds: 2), () {
        _saveProgress();
      });
    }
  }

  Future<void> _loadProgress() async {
    if (_token == null) return;
    
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/chapter/progress/${widget.chapterId}'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Get saved progress
        final savedPercent = data['progressPercent']?.toDouble() ?? 0.0;
        
        setState(() {
          _progressPercent = savedPercent;
        });
        
        // Restore scroll position after widget is built
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            final maxScroll = _scrollController.position.maxScrollExtent;
            if (maxScroll > 0 && savedPercent > 0) {
              // Calculate scroll position from percentage
              final targetPosition = (savedPercent / 100) * maxScroll;
              _scrollController.jumpTo(targetPosition);
            }
          }
        });
      }
    } catch (e) {
      print('Error loading progress: $e');
    }
  }

  Future<void> _saveProgress() async {
    if (_token == null || !_scrollController.hasClients) return;
    
    final currentScroll = _scrollController.position.pixels;
    
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/api/chapter/progress/${widget.chapterId}'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'scrollPosition': currentScroll,
          'progressPercent': _progressPercent.round(),
        }),
      );

      if (response.statusCode == 200) {
        print('Progress saved: ${_progressPercent.round()}%');
      }
    } catch (e) {
      print('Error saving progress: $e');
    }
  }

  @override
  void dispose() {
    // Save progress when leaving the screen
    _saveProgress();
    
    // Clean up
    _debounceTimer?.cancel();
    _periodicTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.chapterTitle),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(8),
          child: Column(
            children: [
              LinearProgressIndicator(
                value: _progressPercent / 100,
                backgroundColor: Colors.grey[300],
                valueColor: AlwaysStoppedAnimation<Color>(
                  Theme.of(context).primaryColor,
                ),
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${_progressPercent.toStringAsFixed(0)}% Complete',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    if (_progressPercent >= 95)
                      Icon(Icons.check_circle, 
                        color: Colors.green, 
                        size: 16,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: SingleChildScrollView(
        controller: _scrollController,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: SelectableText(
            widget.content,
            style: TextStyle(
              fontSize: 16,
              height: 1.6,
              letterSpacing: 0.3,
            ),
          ),
        ),
      ),
      floatingActionButton: _progressPercent < 95
          ? FloatingActionButton.extended(
              onPressed: () {
                // Jump to saved position or continue reading
                _scrollController.animateTo(
                  _scrollController.position.pixels + 500,
                  duration: Duration(milliseconds: 500),
                  curve: Curves.easeInOut,
                );
              },
              icon: Icon(Icons.arrow_downward),
              label: Text('Continue'),
            )
          : null,
    );
  }
}
```

### 2. Novel Progress Overview

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class NovelProgressScreen extends StatelessWidget {
  final String novelId;
  final String novelTitle;

  const NovelProgressScreen({
    Key? key,
    required this.novelId,
    required this.novelTitle,
  }) : super(key: key);

  Future<Map<String, dynamic>> _fetchNovelProgress(String token) async {
    final response = await http.get(
      Uri.parse('http://localhost:3000/api/chapter/novel-progress/$novelId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load progress');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('$novelTitle - Progress'),
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _fetchNovelProgress('YOUR_TOKEN'), // Get from storage
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          if (!snapshot.hasData) {
            return Center(child: Text('No progress data'));
          }

          final data = snapshot.data!;
          final progressList = data['progressList'] as List;
          final stats = data['stats'];

          return Column(
            children: [
              // Overall Progress Card
              Card(
                margin: EdgeInsets.all(16),
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        'Overall Progress',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 16),
                      CircularProgressIndicator(
                        value: stats['overallProgress'] / 100,
                        strokeWidth: 8,
                        backgroundColor: Colors.grey[300],
                      ),
                      SizedBox(height: 8),
                      Text(
                        '${stats['overallProgress']}%',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        '${stats['completedChapters']} of ${stats['totalChapters']} chapters',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
              ),

              // Chapter Progress List
              Expanded(
                child: ListView.builder(
                  itemCount: progressList.length,
                  itemBuilder: (context, index) {
                    final progress = progressList[index];
                    final chapter = progress['chapter'];
                    final percent = progress['progressPercent'];
                    final isCompleted = progress['isCompleted'];

                    return ListTile(
                      leading: CircleAvatar(
                        child: Text('${chapter['chapterNumber']}'),
                        backgroundColor: isCompleted 
                            ? Colors.green 
                            : Colors.grey,
                      ),
                      title: Text(chapter['title']),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(height: 4),
                          LinearProgressIndicator(
                            value: percent / 100,
                            backgroundColor: Colors.grey[300],
                          ),
                          SizedBox(height: 4),
                          Text('$percent% read'),
                        ],
                      ),
                      trailing: isCompleted
                          ? Icon(Icons.check_circle, color: Colors.green)
                          : null,
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
```

### 3. Currently Reading Widget (Home Screen)

```dart
class CurrentlyReadingWidget extends StatelessWidget {
  Future<List<dynamic>> _fetchCurrentlyReading(String token) async {
    final response = await http.get(
      Uri.parse('http://localhost:3000/api/chapter/currently-reading'),
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
      future: _fetchCurrentlyReading('YOUR_TOKEN'),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Continue Reading',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            SizedBox(
              height: 200,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.symmetric(horizontal: 16),
                itemCount: snapshot.data!.length,
                itemBuilder: (context, index) {
                  final item = snapshot.data![index];
                  final novel = item['novel'];
                  final lastChapter = item['lastReadChapter'];
                  final progress = item['progressPercent'];

                  return Container(
                    width: 140,
                    margin: EdgeInsets.only(right: 12),
                    child: GestureDetector(
                      onTap: () {
                        // Navigate to chapter
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  novel['coverImage'],
                                  height: 120,
                                  width: 140,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              Positioned(
                                bottom: 0,
                                left: 0,
                                right: 0,
                                child: Container(
                                  height: 4,
                                  child: LinearProgressIndicator(
                                    value: progress / 100,
                                    backgroundColor: Colors.black26,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 8),
                          Text(
                            novel['title'],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            lastChapter['title'],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                          Text(
                            '${progress.round()}% complete',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
```

## Key Points

### ScrollController Properties:
- `maxScrollExtent` = Total scrollable height (automatically calculated by Flutter)
- `pixels` = Current scroll position
- `minScrollExtent` = Usually 0

### Progress Calculation:
```dart
final progress = (currentPosition / maxScrollExtent) * 100;
```

### You DON'T need to:
- ❌ Manually calculate content height
- ❌ Measure widget sizes
- ❌ Use LayoutBuilder for height

### You SHOULD:
- ✅ Use ScrollController's built-in properties
- ✅ Debounce updates (wait 1-2 seconds after scrolling stops)
- ✅ Save periodically (every 30 seconds)
- ✅ Save on dispose (when leaving the screen)
- ✅ Restore scroll position when opening a chapter

## Testing Tips

1. **Test with different content lengths**
2. **Test rapid scrolling** - debouncing should prevent too many API calls
3. **Test app backgrounding** - save progress in dispose()
4. **Test offline mode** - queue updates and sync later
5. **Test progress restoration** - close and reopen chapter

## Optional: Offline Support

```dart
// Save progress locally first, then sync to server
class ProgressService {
  final LocalDatabase db; // Use Hive, Sqflite, etc.
  
  Future<void> updateProgress({
    required String chapterId,
    required double scrollPosition,
    required int progressPercent,
  }) async {
    // Save locally first
    await db.saveProgress(chapterId, scrollPosition, progressPercent);
    
    // Try to sync with server
    try {
      await _syncToServer(chapterId, scrollPosition, progressPercent);
    } catch (e) {
      // Will retry on next sync
      print('Offline: Progress saved locally');
    }
  }
  
  Future<void> syncAllProgress() async {
    final pendingProgress = await db.getPendingSync();
    for (var progress in pendingProgress) {
      try {
        await _syncToServer(
          progress.chapterId,
          progress.scrollPosition,
          progress.progressPercent,
        );
        await db.markSynced(progress.id);
      } catch (e) {
        print('Sync failed for ${progress.chapterId}');
      }
    }
  }
}
```
