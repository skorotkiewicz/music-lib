use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::fs::{create_dir_all, remove_file};
use tokio::process::Command;
use warp::Filter;
use serde::{Deserialize, Serialize};
use clap::Parser;
use uuid::Uuid;
use sha2::{Sha256, Digest};
use std::sync::Mutex;
use tokio::sync::RwLock;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long, default_value = "8080")]
    port: u16,
    
    #[arg(long, default_value = "./hls_cache")]
    cache_path: PathBuf,
    
    /// Enable readonly mode - disables adding and removing tracks
    #[arg(long, default_value = "false")]
    readonly: bool,
}

#[derive(Debug, Clone)]
struct HlsSession {
    id: String,
    title: String,
    origin_url: String,
    segments_dir: PathBuf,
    playlist_path: PathBuf,
    total_segments: u32,
    segment_duration: f32,
    listen_count: u64,
}

#[derive(Serialize, Deserialize)]
struct HlsCacheEntry {
    file_hash: String,
    session_id: String,
    title: String,
    #[serde(default)]
    origin_url: String,
    segments_dir: String,
    playlist_path: String,
    total_segments: u32,
    segment_duration: f32,
    #[serde(default)]
    listen_count: u64,
}

#[derive(Serialize, Deserialize)]
struct HlsCacheData {
    entries: Vec<HlsCacheEntry>,
}

#[derive(Debug, Deserialize)]
struct DownloadRequest {
    url: String,
    title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadResponse {
    id: String,
    title: String,
    session_id: String,
    playlist_url: String,
    total_segments: u32,
    segment_duration: f32,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadStatus {
    id: String,
    status: String,
    progress: Option<String>,
    error: Option<String>,
    session: Option<DownloadResponse>,
}

#[derive(Debug, Clone, Serialize)]
struct TrackInfo {
    id: String,
    title: String,
    url: String,
    session_id: String,
    total_segments: u32,
    segment_duration: f32,
    listen_count: u64,
}

type HlsCache = Arc<Mutex<HashMap<String, HlsSession>>>;
type DownloadQueue = Arc<RwLock<HashMap<String, DownloadStatus>>>;

fn is_audio_file(path: &Path) -> bool {
    match path.extension() {
        Some(ext) => {
            let ext = ext.to_string_lossy().to_lowercase();
            matches!(ext.as_str(), "wav" | "mp3" | "mp4" | "flac" | "ogg" | "m4a" | "aac")
        }
        None => false,
    }
}

fn generate_url_hash(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    hex::encode(hasher.finalize())
}

async fn load_hls_cache(cache_dir: &Path) -> Result<HashMap<String, HlsSession>, Box<dyn std::error::Error + Send + Sync>> {
    let cache_file = cache_dir.join("hls_cache.json");
    let mut cache_map = HashMap::new();
    
    if cache_file.exists() {
        match tokio::fs::read_to_string(&cache_file).await {
            Ok(content) => {
                match serde_json::from_str::<HlsCacheData>(&content) {
                    Ok(cache_data) => {
                        for entry in cache_data.entries {
                            let segments_dir = PathBuf::from(&entry.segments_dir);
                            let playlist_path = PathBuf::from(&entry.playlist_path);
                            
                            if segments_dir.exists() && playlist_path.exists() {
                                let session = HlsSession {
                                    id: entry.session_id,
                                    title: entry.title,
                                    origin_url: entry.origin_url,
                                    segments_dir,
                                    playlist_path,
                                    total_segments: entry.total_segments,
                                    segment_duration: entry.segment_duration,
                                    listen_count: entry.listen_count,
                                };
                                cache_map.insert(entry.file_hash, session);
                            }
                        }
                        println!("✓ Loaded {} HLS cache entries from disk", cache_map.len());
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to parse hls_cache.json: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to read hls_cache.json: {}", e);
            }
        }
    }
    
    Ok(cache_map)
}

async fn save_hls_cache(cache_dir: &Path, cache: &HashMap<String, HlsSession>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let cache_file = cache_dir.join("hls_cache.json");
    let mut entries = Vec::new();
    
    for (file_hash, session) in cache {
        let entry = HlsCacheEntry {
            file_hash: file_hash.clone(),
            session_id: session.id.clone(),
            title: session.title.clone(),
            origin_url: session.origin_url.clone(),
            segments_dir: session.segments_dir.to_string_lossy().to_string(),
            playlist_path: session.playlist_path.to_string_lossy().to_string(),
            total_segments: session.total_segments,
            segment_duration: session.segment_duration,
            listen_count: session.listen_count,
        };
        entries.push(entry);
    }
    
    let cache_data = HlsCacheData { entries };
    let json_content = serde_json::to_string_pretty(&cache_data)?;
    tokio::fs::write(&cache_file, json_content).await?;
    
    Ok(())
}

async fn create_hls_segments(
    file_path: &Path,
    cache_dir: &Path,
    session_id: &str,
    title: &str,
    origin_url: &str,
) -> Result<HlsSession, Box<dyn std::error::Error + Send + Sync>> {
    let segments_dir = cache_dir.join(session_id);
    create_dir_all(&segments_dir).await?;
    
    let playlist_path = segments_dir.join("playlist.m3u8");
    let segment_duration = 10.0;
    
    let output = Command::new("ffmpeg")
        .args(&[
            "-i", file_path.to_str().unwrap(),
            "-c:a", "aac",
            "-b:a", "128k",
            "-hls_time", &segment_duration.to_string(),
            "-hls_list_size", "0",
            "-hls_segment_filename", &format!("{}/%03d.ts", segments_dir.display()),
            playlist_path.to_str().unwrap()
        ])
        .output()
        .await?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error).into());
    }
    
    let playlist_content = tokio::fs::read_to_string(&playlist_path).await?;
    let total_segments = playlist_content.lines()
        .filter(|line| line.ends_with(".ts"))
        .count() as u32;
    
    Ok(HlsSession {
        id: session_id.to_string(),
        title: title.to_string(),
        origin_url: origin_url.to_string(),
        segments_dir,
        playlist_path,
        total_segments,
        segment_duration,
        listen_count: 0,
    })
}

async fn download_from_url(
    url: &str,
    title: Option<String>,
    cache_dir: &Path,
    hls_cache: HlsCache,
    download_queue: DownloadQueue,
    download_id: &str,
) -> Result<DownloadResponse, Box<dyn std::error::Error + Send + Sync>> {
    // Check if this URL already exists in cache
    {
        let cache = hls_cache.lock().unwrap();
        for session in cache.values() {
            if session.origin_url == url {
                return Err(format!(
                    "This song is already downloaded: \"{}\"",
                    session.title
                ).into());
            }
        }
    }
    
    let session_id = Uuid::new_v4().to_string();
    let download_dir = cache_dir.join(&session_id);
    create_dir_all(&download_dir).await?;
    
    {
        let mut queue = download_queue.write().await;
        if let Some(status) = queue.get_mut(download_id) {
            status.status = "downloading".to_string();
            status.progress = Some("Starting download...".to_string());
        }
    }
    
    let output_template = download_dir.join("audio.%(ext)s");
    let output = Command::new("yt-dlp")
        .args(&[
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_template.to_str().unwrap(),
            "--no-playlist",
            "--force-overwrites",
            url,
        ])
        .output()
        .await?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("yt-dlp error: {} {}", error, stdout).into());
    }
    
    // Find the downloaded audio file
    let mut downloaded_file: Option<PathBuf> = None;
    for entry in std::fs::read_dir(&download_dir)? {
        if let Ok(entry) = entry {
            let path = entry.path();
            if is_audio_file(&path) {
                downloaded_file = Some(path);
                break;
            }
        }
    }
    
    let actual_file = match downloaded_file {
        Some(f) => f,
        None => {
            return Err("Downloaded file not found after yt-dlp completed".into());
        }
    };
    
    // Use provided title or generate from URL
    let track_title = title.unwrap_or_else(|| {
        format!("Track {}", &session_id[..8])
    });
    
    {
        let mut queue = download_queue.write().await;
        if let Some(status) = queue.get_mut(download_id) {
            status.status = "converting".to_string();
            status.progress = Some("Converting to HLS format...".to_string());
        }
    }
    
    // Create HLS segments
    let session = create_hls_segments(&actual_file, cache_dir, &session_id, &track_title, url).await?;
    
    // Delete the downloaded mp3 file after conversion
    if let Err(e) = remove_file(&actual_file).await {
        eprintln!("Warning: Failed to delete source file: {}", e);
    }
    
    // Generate hash from URL for caching
    let url_hash = generate_url_hash(url);
    {
        let mut cache = hls_cache.lock().unwrap();
        cache.insert(url_hash.clone(), session.clone());
    }
    
    // Save cache to disk
    let cache_data = {
        let cache = hls_cache.lock().unwrap();
        cache.clone()
    };
    if let Err(e) = save_hls_cache(cache_dir, &cache_data).await {
        eprintln!("Warning: Failed to save HLS cache: {}", e);
    }
    
    let response = DownloadResponse {
        id: download_id.to_string(),
        title: track_title,
        session_id: session.id.clone(),
        playlist_url: format!("/api/hls/{}/playlist.m3u8", session.id),
        total_segments: session.total_segments,
        segment_duration: session.segment_duration,
    };
    
    {
        let mut queue = download_queue.write().await;
        if let Some(status) = queue.get_mut(download_id) {
            status.status = "ready".to_string();
            status.progress = None;
            status.session = Some(response.clone());
        }
    }
    
    Ok(response)
}

async fn serve_hls_playlist(
    hls_cache: HlsCache,
    session_id: String,
    cache_dir: &Path,
) -> Result<impl warp::Reply, warp::Rejection> {
    // Find the file_hash for this session and increment listen count
    let file_hash_to_update = {
        let cache = hls_cache.lock().unwrap();
        cache.iter()
            .find(|(_, s)| s.id == session_id)
            .map(|(hash, _)| hash.clone())
    };
    
    if let Some(hash) = file_hash_to_update {
        {
            let mut cache = hls_cache.lock().unwrap();
            if let Some(session) = cache.get_mut(&hash) {
                session.listen_count += 1;
            }
        }
        
        // Save cache to disk
        let cache_data = {
            let cache = hls_cache.lock().unwrap();
            cache.clone()
        };
        if let Err(e) = save_hls_cache(cache_dir, &cache_data).await {
            eprintln!("Warning: Failed to save HLS cache: {}", e);
        }
    }
    
    let session = {
        let cache = hls_cache.lock().unwrap();
        cache.values().find(|s| s.id == session_id).cloned()
    };
    
    if let Some(session) = session {
        match tokio::fs::read_to_string(&session.playlist_path).await {
            Ok(content) => {
                Ok(warp::reply::with_header(
                    content,
                    "Content-Type",
                    "application/vnd.apple.mpegurl"
                ))
            }
            Err(_) => Err(warp::reject::not_found())
        }
    } else {
        Err(warp::reject::not_found())
    }
}

async fn serve_hls_segment(
    hls_cache: HlsCache,
    session_id: String,
    segment_name: String,
) -> Result<impl warp::Reply, warp::Rejection> {
    let session = {
        let cache = hls_cache.lock().unwrap();
        cache.values().find(|s| s.id == session_id).cloned()
    };
    
    if let Some(session) = session {
        let segment_path = session.segments_dir.join(&segment_name);
        
        if !segment_path.starts_with(&session.segments_dir) {
            return Err(warp::reject::custom(Forbidden));
        }
        
        match tokio::fs::read(&segment_path).await {
            Ok(data) => {
                Ok(warp::reply::with_header(
                    data,
                    "Content-Type",
                    "video/mp2t"
                ))
            }
            Err(_) => Err(warp::reject::not_found())
        }
    } else {
        Err(warp::reject::not_found())
    }
}

#[derive(Debug)]
struct Forbidden;
impl warp::reject::Reject for Forbidden {}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    
    // Check if ffmpeg is available
    match Command::new("ffmpeg").arg("-version").output().await {
        Ok(output) if output.status.success() => {
            println!("✓ FFmpeg found");
        }
        _ => {
            eprintln!("❌ FFmpeg not found! Please install FFmpeg for HLS streaming.");
            eprintln!("Ubuntu/Debian: sudo apt install ffmpeg");
            eprintln!("macOS: brew install ffmpeg");
            std::process::exit(1);
        }
    }
    
    // Check if yt-dlp is available
    match Command::new("yt-dlp").arg("--version").output().await {
        Ok(output) if output.status.success() => {
            println!("✓ yt-dlp found");
        }
        _ => {
            eprintln!("⚠️  yt-dlp not found! URL downloads will not work.");
            eprintln!("Install with: pip install yt-dlp");
        }
    }
    
    let cache_dir = Arc::new(args.cache_path.clone());
    
    // Create cache directory
    if let Err(e) = create_dir_all(&*cache_dir).await {
        eprintln!("Failed to create cache directory: {}", e);
        std::process::exit(1);
    }
    
    // Load existing HLS cache from disk
    let initial_cache = match load_hls_cache(&cache_dir).await {
        Ok(cache) => cache,
        Err(e) => {
            eprintln!("Warning: Failed to load HLS cache: {}", e);
            HashMap::new()
        }
    };
    
    let hls_cache: HlsCache = Arc::new(Mutex::new(initial_cache));
    let download_queue: DownloadQueue = Arc::new(RwLock::new(HashMap::new()));
    
    let readonly_mode = args.readonly;
    
    println!("🎵 Starting HLS music server on port {}", args.port);
    println!("🗄️ HLS cache directory: {}", cache_dir.display());
    if readonly_mode {
        println!("Running in READONLY mode - adding/removing tracks disabled");
    } else {
        println!("🔗 URL downloads enabled with yt-dlp");
    }
    
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["content-type", "range"])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"]);
    
    // List all tracks from HLS cache
    let tracks_route = warp::path("api")
        .and(warp::path("tracks"))
        .and(warp::path::end())
        .and(warp::get())
        .and_then({
            let hls_cache = Arc::clone(&hls_cache);
            move || {
                let hls_cache = Arc::clone(&hls_cache);
                async move {
                    let cache = hls_cache.lock().unwrap();
                    let tracks: Vec<TrackInfo> = cache.iter().map(|(hash, session)| {
                        TrackInfo {
                            id: hash.clone(),
                            title: session.title.clone(),
                            url: format!("/api/hls/{}/playlist.m3u8", session.id),
                            session_id: session.id.clone(),
                            total_segments: session.total_segments,
                            segment_duration: session.segment_duration,
                            listen_count: session.listen_count,
                        }
                    }).collect();
                    
                    Ok::<_, warp::Rejection>(warp::reply::json(&tracks))
                }
            }
        });
    
    let hls_playlist_route = warp::path("api")
        .and(warp::path("hls"))
        .and(warp::path::param::<String>())
        .and(warp::path("playlist.m3u8"))
        .and(warp::get())
        .and_then({
            let hls_cache = Arc::clone(&hls_cache);
            let cache_dir = Arc::clone(&cache_dir);
            move |session_id: String| {
                let hls_cache = Arc::clone(&hls_cache);
                let cache_dir = Arc::clone(&cache_dir);
                async move {
                    serve_hls_playlist(hls_cache, session_id, &cache_dir).await
                }
            }
        });
    
    let hls_segment_route = warp::path("api")
        .and(warp::path("hls"))
        .and(warp::path::param::<String>())
        .and(warp::path::param::<String>())
        .and(warp::get())
        .and_then({
            let hls_cache = Arc::clone(&hls_cache);
            move |session_id: String, segment_name: String| {
                let hls_cache = Arc::clone(&hls_cache);
                async move {
                    serve_hls_segment(hls_cache, session_id, segment_name).await
                }
            }
        });
    
    // Download from URL endpoint
    let download_route = warp::path("api")
        .and(warp::path("download"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json::<DownloadRequest>())
        .and_then({
            let cache_dir = Arc::clone(&cache_dir);
            let hls_cache = Arc::clone(&hls_cache);
            let download_queue = Arc::clone(&download_queue);
            move |request: DownloadRequest| {
                let cache_dir = Arc::clone(&cache_dir);
                let hls_cache = Arc::clone(&hls_cache);
                let download_queue = Arc::clone(&download_queue);
                async move {
                    let download_id = Uuid::new_v4().to_string();
                    
                    {
                        let mut queue = download_queue.write().await;
                        queue.insert(download_id.clone(), DownloadStatus {
                            id: download_id.clone(),
                            status: "queued".to_string(),
                            progress: Some("Starting download...".to_string()),
                            error: None,
                            session: None,
                        });
                    }
                    
                    match download_from_url(
                        &request.url,
                        request.title,
                        &cache_dir,
                        hls_cache,
                        download_queue.clone(),
                        &download_id,
                    ).await {
                        Ok(response) => {
                            Ok::<_, warp::Rejection>(warp::reply::with_status(
                                warp::reply::json(&response),
                                warp::http::StatusCode::OK,
                            ))
                        }
                        Err(e) => {
                            let error_msg = e.to_string();
                            {
                                let mut queue = download_queue.write().await;
                                if let Some(status) = queue.get_mut(&download_id) {
                                    status.status = "error".to_string();
                                    status.error = Some(error_msg.clone());
                                }
                            }
                            
                            // Check if it's a duplicate error
                            let status_code = if error_msg.contains("already downloaded") {
                                warp::http::StatusCode::CONFLICT // 409
                            } else {
                                warp::http::StatusCode::INTERNAL_SERVER_ERROR // 500
                            };
                            
                            Ok(warp::reply::with_status(
                                warp::reply::json(&serde_json::json!({
                                    "error": error_msg
                                })),
                                status_code,
                            ))
                        }
                    }
                }
            }
        });
    
    // Download status check endpoint
    let download_status_route = warp::path("api")
        .and(warp::path("download"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::get())
        .and_then({
            let download_queue = Arc::clone(&download_queue);
            move |download_id: String| {
                let download_queue = Arc::clone(&download_queue);
                async move {
                    let queue = download_queue.read().await;
                    if let Some(status) = queue.get(&download_id) {
                        Ok::<_, warp::Rejection>(warp::reply::json(status))
                    } else {
                        Err(warp::reject::not_found())
                    }
                }
            }
        });
    
    // Delete track endpoint
    let delete_track_route = warp::path("api")
        .and(warp::path("tracks"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::delete())
        .and_then({
            let hls_cache = Arc::clone(&hls_cache);
            let cache_dir = Arc::clone(&cache_dir);
            move |track_id: String| {
                let hls_cache = Arc::clone(&hls_cache);
                let cache_dir = Arc::clone(&cache_dir);
                async move {
                    // Find and remove the session from cache
                    let session_to_delete = {
                        let mut cache = hls_cache.lock().unwrap();
                        cache.remove(&track_id)
                    };
                    
                    if let Some(session) = session_to_delete {
                        // Delete the segments directory
                        if session.segments_dir.exists() {
                            if let Err(e) = tokio::fs::remove_dir_all(&session.segments_dir).await {
                                eprintln!("Warning: Failed to delete segments dir: {}", e);
                            }
                        }
                        
                        // Save updated cache to disk
                        let cache_data = {
                            let cache = hls_cache.lock().unwrap();
                            cache.clone()
                        };
                        if let Err(e) = save_hls_cache(&cache_dir, &cache_data).await {
                            eprintln!("Warning: Failed to save HLS cache: {}", e);
                        }
                        
                        Ok::<_, warp::Rejection>(warp::reply::json(&serde_json::json!({
                            "success": true,
                            "message": format!("Track '{}' deleted", session.title)
                        })))
                    } else {
                        Err(warp::reject::not_found())
                    }
                }
            }
        });
    
    // Mode endpoint - returns current mode (readonly/readwrite)
    let mode_route = warp::path("api")
        .and(warp::path("mode"))
        .and(warp::path::end())
        .and(warp::get())
        .map(move || {
            warp::reply::json(&serde_json::json!({
                "readonly": readonly_mode,
                "mode": if readonly_mode { "readonly" } else { "readwrite" }
            }))
        });
    
    // Build routes based on mode
    let base_routes = tracks_route
        .or(mode_route)
        .or(hls_playlist_route)
        .or(hls_segment_route);
    
    if readonly_mode {
        // Readonly mode - only allow reading tracks and streaming
        let routes = base_routes.with(cors);
        warp::serve(routes)
            .run(([0, 0, 0, 0], args.port))
            .await;
    } else {
        // Readwrite mode - allow all operations
        let routes = base_routes
            .or(delete_track_route)
            .or(download_route)
            .or(download_status_route)
            .with(cors);
        warp::serve(routes)
            .run(([0, 0, 0, 0], args.port))
            .await;
    }
}