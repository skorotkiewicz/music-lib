use m2ts_packet::TsPacketDecoder;
use m2ts_packet::UnpackedDecoder;
use reqwest::Client;
use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;

pub enum AudioEvent {
    Stop,
    Seek(Duration),
}

pub struct AudioPlayer {
    _stream: MixerDeviceSink,
    player: Arc<Mutex<Player>>,
    client: Client,
    pub stop_tx: Option<mpsc::Sender<AudioEvent>>,
    is_buffering: Arc<AtomicBool>,
    appended_segments: Arc<AtomicUsize>,
    segment_duration_secs: Arc<Mutex<f32>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let mut stream = DeviceSinkBuilder::open_default_sink()?;
        stream.log_on_drop(false);
        let player = Player::connect_new(stream.mixer());

        Ok(Self {
            _stream: stream,
            player: Arc::new(Mutex::new(player)),
            client: Client::new(),
            stop_tx: None,
            is_buffering: Arc::new(AtomicBool::new(false)),
            appended_segments: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            segment_duration_secs: Arc::new(Mutex::new(10.0)),
        })
    }

    pub fn play_hls(&mut self, base_url: &str, playlist_url: &str, segment_duration_secs: f32) {
        self.stop();

        *self.segment_duration_secs.lock().unwrap() = segment_duration_secs;

        // Use a background channel to tell tokio loop to stop/seek
        let (tx, mut rx) = mpsc::channel(10);
        self.stop_tx = Some(tx);

        self.is_buffering.store(true, Ordering::SeqCst);
        self.appended_segments.store(0, Ordering::SeqCst);
        let appended_clone = Arc::clone(&self.appended_segments);
        let is_buf_clone = Arc::clone(&self.is_buffering);
        let player_clone: Arc<Mutex<Player>> = Arc::clone(&self.player);
        let client = self.client.clone();
        let full_playlist_url = format!("{}{}", base_url, playlist_url);
        let base_url = base_url.to_string();

        let session_path = if let Some(idx) = playlist_url.rfind('/') {
            playlist_url[..=idx].to_string()
        } else {
            return;
        };

        tokio::spawn(async move {
            // First, fetch the m3u8 playlist
            let playlist_res = match client.get(&full_playlist_url).send().await {
                Ok(res) => res.text().await.unwrap_or_default(),
                Err(_) => {
                    is_buf_clone.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let mut segments = Vec::new();
            for line in playlist_res.lines() {
                if !line.starts_with('#') && !line.is_empty() {
                    segments.push(line.to_string());
                }
            }

            // Keep track of which segment we are currently downloading
            let mut current_segment_idx = 0;
            let mut seek_offset = 0.0;

            'outer: loop {
                // Check for seek or stop instructions before downloading a segment
                while let Ok(event) = rx.try_recv() {
                    match event {
                        AudioEvent::Stop => {
                            is_buf_clone.store(false, Ordering::SeqCst);
                            return;
                        }
                        AudioEvent::Seek(pos) => {
                            let total_secs = pos.as_secs_f32();
                            let idx = (total_secs / segment_duration_secs).floor() as usize;
                            if idx < segments.len() {
                                let player = player_clone.lock().unwrap();
                                let was_paused = player.is_paused();
                                // Clear rodio player
                                player.clear();
                                if !was_paused {
                                    player.play();
                                }
                                // Reset counters exactly to the new segment
                                appended_clone.store(idx, Ordering::SeqCst);
                                current_segment_idx = idx;
                                seek_offset = total_secs % segment_duration_secs;
                            } else {
                                // Seeked beyond end
                                is_buf_clone.store(false, Ordering::SeqCst);
                                return;
                            }
                        }
                    }
                }

                if current_segment_idx >= segments.len() {
                    break;
                }

                let segment = &segments[current_segment_idx];
                let segment_url = format!("{}{}{}", base_url, session_path, segment);

                // Fetch segment
                if let Ok(res) = client.get(&segment_url).send().await
                    && let Ok(bytes) = res.bytes().await
                {
                    let cursor = std::io::Cursor::new(bytes.to_vec());
                    let ts_packets = tokio_util::codec::FramedRead::new(cursor, TsPacketDecoder);
                    let mut unpack = UnpackedDecoder::new(ts_packets);

                    let mut audio_payload = Vec::new();

                    while let Some(Ok(unpacked)) = unpack.next().await {
                        if let m2ts_packet::Unpacked::Audio { payload, .. } = unpacked {
                            audio_payload.extend_from_slice(&payload);
                        }
                    }

                    if !audio_payload.is_empty()
                        && let Ok(decoder) = Decoder::new(Cursor::new(audio_payload))
                    {
                        {
                            let player = player_clone.lock().unwrap();
                            player.append(decoder);

                            if seek_offset > 0.0 {
                                let _ = player.try_seek(Duration::from_secs_f32(seek_offset));
                                seek_offset = 0.0;
                            }

                            appended_clone.fetch_add(1, Ordering::SeqCst);
                        }

                        // Wait if queue is long
                        loop {
                            let len = { player_clone.lock().unwrap().len() };
                            if len <= 2 {
                                break;
                            }
                            tokio::time::sleep(Duration::from_millis(100)).await;

                            // Check again during sleep
                            if let Ok(event) = rx.try_recv() {
                                match event {
                                    AudioEvent::Stop => {
                                        is_buf_clone.store(false, Ordering::SeqCst);
                                        return;
                                    }
                                    AudioEvent::Seek(pos) => {
                                        let total_secs = pos.as_secs_f32();
                                        let idx =
                                            (total_secs / segment_duration_secs).floor() as usize;
                                        if idx < segments.len() {
                                            let player = player_clone.lock().unwrap();
                                            let was_paused = player.is_paused();
                                            player.clear();
                                            if !was_paused {
                                                player.play();
                                            }
                                            appended_clone.store(idx, Ordering::SeqCst);
                                            current_segment_idx = idx;
                                            seek_offset = total_secs % segment_duration_secs;
                                            continue 'outer; // Restart outer loop immediately
                                        } else {
                                            is_buf_clone.store(false, Ordering::SeqCst);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                current_segment_idx += 1;
            }

            // Reached end of playlist (or stopped)
            is_buf_clone.store(false, Ordering::SeqCst);
        });

        self.player.lock().unwrap().play();
    }

    pub fn toggle_pause(&self) {
        let player = self.player.lock().unwrap();
        if player.is_paused() {
            player.play();
        } else {
            player.pause();
        }
    }

    pub fn set_volume(&self, vol: f32) {
        self.player.lock().unwrap().set_volume(vol);
    }

    pub fn get_volume(&self) -> f32 {
        self.player.lock().unwrap().volume()
    }

    pub fn volume_up(&self) {
        let v = self.get_volume() + 0.1;
        self.set_volume(v.min(2.0));
    }

    pub fn get_global_pos(&self) -> Duration {
        let player = self.player.lock().unwrap();
        let appended = self.appended_segments.load(Ordering::SeqCst);
        let remaining = player.len();
        let finished = appended.saturating_sub(remaining);

        let sd = *self.segment_duration_secs.lock().unwrap();
        let completed_duration = Duration::from_secs_f32(finished as f32 * sd);
        completed_duration + player.get_pos()
    }

    pub fn volume_down(&self) {
        let v = self.get_volume() - 0.1;
        self.set_volume(v.max(0.0));
    }

    pub fn seek_forward(&self, d: Duration) {
        let current = self.get_global_pos();
        if let Some(tx) = &self.stop_tx {
            let _ = tx.try_send(AudioEvent::Seek(current + d));
        }
    }

    pub fn seek_backward(&self, d: Duration) {
        let current = self.get_global_pos();
        if let Some(tx) = &self.stop_tx {
            if current > d {
                let _ = tx.try_send(AudioEvent::Seek(current - d));
            } else {
                let _ = tx.try_send(AudioEvent::Seek(Duration::ZERO));
            }
        }
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.try_send(AudioEvent::Stop);
        }
        self.appended_segments.store(0, Ordering::SeqCst);
        let player = self.player.lock().unwrap();
        player.clear();
    }

    pub fn is_empty(&self) -> bool {
        self.player.lock().unwrap().empty() && !self.is_buffering.load(Ordering::SeqCst)
    }
}
