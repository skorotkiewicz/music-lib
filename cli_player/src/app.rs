use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct TrackInfo {
    pub id: String,
    pub title: String,
    pub url: String,
    pub total_segments: u32,
    pub segment_duration: f32,
    pub listen_count: u64,
}

pub enum InputMode {
    Normal,
    Search,
}

#[derive(PartialEq)]
pub enum RepeatMode {
    Off,
    All,
    One,
}

pub struct App {
    pub tracks: Vec<TrackInfo>,
    pub filtered_tracks: Vec<TrackInfo>,
    pub server_url: String,
    pub search_query: String,
    pub input_mode: InputMode,
    pub current_track: Option<TrackInfo>,
    pub current_track_index: Option<usize>, // index in filtered_tracks
    pub list_state: ratatui::widgets::ListState,
    pub volume: f32,
    pub is_playing: bool,
    pub is_muted: bool,
    pub shuffle_mode: bool,
    pub repeat_mode: RepeatMode,
    pub sleep_timer: Option<u64>, // seconds remaining
    pub should_quit: bool,
}

impl App {
    pub fn new(server_url: String) -> Self {
        Self {
            tracks: Vec::new(),
            filtered_tracks: Vec::new(),
            server_url,
            search_query: String::new(),
            input_mode: InputMode::Normal,
            current_track: None,
            current_track_index: None,
            list_state: ratatui::widgets::ListState::default(),
            volume: 1.0,
            is_playing: false,
            is_muted: false,
            shuffle_mode: false,
            repeat_mode: RepeatMode::Off,
            sleep_timer: None,
            should_quit: false,
        }
    }

    pub fn set_tracks(&mut self, tracks: Vec<TrackInfo>) {
        self.tracks = tracks;
        self.filter_tracks();
    }

    pub fn filter_tracks(&mut self) {
        if self.search_query.is_empty() {
            self.filtered_tracks = self.tracks.clone();
        } else {
            let query = self.search_query.to_lowercase();
            self.filtered_tracks = self
                .tracks
                .iter()
                .filter(|t| t.title.to_lowercase().contains(&query))
                .cloned()
                .collect();
        }
        // Keep list state valid
        if self.filtered_tracks.is_empty() {
            self.list_state.select(None);
        } else if let Some(selected) = self.list_state.selected() {
            if selected >= self.filtered_tracks.len() {
                self.list_state.select(Some(self.filtered_tracks.len() - 1));
            }
        } else {
            self.list_state.select(Some(0));
        }
    }

    pub fn next(&mut self) {
        if self.filtered_tracks.is_empty() {
            return;
        }
        let i = match self.list_state.selected() {
            Some(i) => {
                if i >= self.filtered_tracks.len() - 1 {
                    0
                } else {
                    i + 1
                }
            }
            None => 0,
        };
        self.list_state.select(Some(i));
    }

    pub fn previous(&mut self) {
        if self.filtered_tracks.is_empty() {
            return;
        }
        let i = match self.list_state.selected() {
            Some(i) => {
                if i == 0 {
                    self.filtered_tracks.len() - 1
                } else {
                    i - 1
                }
            }
            None => 0,
        };
        self.list_state.select(Some(i));
    }

    pub fn select_current(&mut self) {
        if let Some(selected) = self.list_state.selected()
            && selected < self.filtered_tracks.len()
        {
            self.current_track = Some(self.filtered_tracks[selected].clone());
            self.current_track_index = Some(selected);
            self.is_playing = true;
        }
    }

    pub fn play_next_track(&mut self) -> bool {
        if self.filtered_tracks.is_empty() {
            return false;
        }

        if self.repeat_mode == RepeatMode::One && self.current_track.is_some() {
            return true; // Keep same track
        }

        if self.shuffle_mode {
            let next_idx = rand::random::<u16>() as usize % self.filtered_tracks.len();
            self.current_track = Some(self.filtered_tracks[next_idx].clone());
            self.current_track_index = Some(next_idx);
            self.list_state.select(Some(next_idx));
            return true;
        }

        if let Some(idx) = self.current_track_index {
            if idx + 1 < self.filtered_tracks.len() {
                let next_idx = idx + 1;
                self.current_track = Some(self.filtered_tracks[next_idx].clone());
                self.current_track_index = Some(next_idx);
                self.list_state.select(Some(next_idx));
                return true;
            } else if self.repeat_mode == RepeatMode::All {
                self.current_track = Some(self.filtered_tracks[0].clone());
                self.current_track_index = Some(0);
                self.list_state.select(Some(0));
                return true;
            }
        } else {
            // No track playing, play first
            self.current_track = Some(self.filtered_tracks[0].clone());
            self.current_track_index = Some(0);
            self.list_state.select(Some(0));
            return true;
        }

        self.is_playing = false;
        false
    }

    pub fn play_previous_track(&mut self) -> bool {
        if self.filtered_tracks.is_empty() {
            return false;
        }

        if self.shuffle_mode {
            let next_idx = rand::random::<u16>() as usize % self.filtered_tracks.len();
            self.current_track = Some(self.filtered_tracks[next_idx].clone());
            self.current_track_index = Some(next_idx);
            self.list_state.select(Some(next_idx));
            return true;
        }

        if let Some(idx) = self.current_track_index {
            if idx > 0 {
                let next_idx = idx - 1;
                self.current_track = Some(self.filtered_tracks[next_idx].clone());
                self.current_track_index = Some(next_idx);
                self.list_state.select(Some(next_idx));
                return true;
            } else if self.repeat_mode == RepeatMode::All {
                let next_idx = self.filtered_tracks.len() - 1;
                self.current_track = Some(self.filtered_tracks[next_idx].clone());
                self.current_track_index = Some(next_idx);
                self.list_state.select(Some(next_idx));
                return true;
            }
        }
        false
    }

    pub fn toggle_repeat(&mut self) {
        self.repeat_mode = match self.repeat_mode {
            RepeatMode::Off => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::Off,
        };
    }
}
