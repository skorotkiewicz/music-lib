mod app;
mod audio;
mod ui;

use app::{App, InputMode, TrackInfo};
use audio::AudioPlayer;
use clap::Parser;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ratatui::{Terminal, backend::CrosstermBackend};
use std::{
    error::Error,
    io,
    time::{Duration, Instant},
};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long, default_value = "http://localhost:8080")]
    http: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let server_url = args.http.trim_end_matches('/').to_string();

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Setup App & Audio
    let mut app = App::new(server_url.clone());
    let mut audio_player = AudioPlayer::new()?;

    // Fetch initial track list
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/tracks", server_url))
        .send()
        .await;
    if let Ok(response) = res
        && let Ok(tracks) = response.json::<Vec<TrackInfo>>().await
    {
        app.set_tracks(tracks);
    }

    // Run event loop
    let tick_rate = Duration::from_millis(250);
    let mut last_tick = Instant::now();

    loop {
        terminal.draw(|f| ui::draw(f, &mut app, &audio_player))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if crossterm::event::poll(timeout)?
            && let Event::Key(key) = event::read()?
        {
            match app.input_mode {
                InputMode::Normal => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => app.should_quit = true,
                    KeyCode::Down | KeyCode::Char('j') => app.next(),
                    KeyCode::Up | KeyCode::Char('k') => app.previous(),
                    KeyCode::Enter => {
                        app.select_current();
                        if let Some(track) = &app.current_track {
                            audio_player.play_hls(
                                &app.server_url,
                                &track.url,
                                track.segment_duration,
                            );
                            app.is_playing = true;
                        }
                    }
                    KeyCode::Char(' ') => {
                        audio_player.toggle_pause();
                        app.is_playing = !app.is_playing;
                    }
                    KeyCode::Char('m') | KeyCode::Char('M') => {
                        if app.is_muted {
                            audio_player.set_volume(app.volume);
                            app.is_muted = false;
                        } else {
                            app.volume = audio_player.get_volume();
                            audio_player.set_volume(0.0);
                            app.is_muted = true;
                        }
                    }
                    KeyCode::Char('s') | KeyCode::Char('S') => {
                        app.shuffle_mode = !app.shuffle_mode;
                    }
                    KeyCode::Char('r') | KeyCode::Char('R') => {
                        app.toggle_repeat();
                    }
                    KeyCode::Char('t') | KeyCode::Char('T') => {
                        // Add 15 mins (900 seconds)
                        let current = app.sleep_timer.unwrap_or(0);
                        app.sleep_timer = Some(current + 900);
                    }
                    KeyCode::Left => {
                        if app.play_previous_track()
                            && let Some(track) = &app.current_track
                        {
                            audio_player.play_hls(
                                &app.server_url,
                                &track.url,
                                track.segment_duration,
                            );
                            app.is_playing = true;
                        }
                    }
                    KeyCode::Right => {
                        if app.play_next_track()
                            && let Some(track) = &app.current_track
                        {
                            audio_player.play_hls(
                                &app.server_url,
                                &track.url,
                                track.segment_duration,
                            );
                            app.is_playing = true;
                        }
                    }
                    KeyCode::Char('d') => {
                        audio_player.seek_forward(Duration::from_secs(5));
                    }
                    KeyCode::Char('a') => {
                        audio_player.seek_backward(Duration::from_secs(5));
                    }
                    KeyCode::Char('+') | KeyCode::Char('=') => {
                        audio_player.volume_up();
                        app.volume = audio_player.get_volume();
                        app.is_muted = false;
                    }
                    KeyCode::Char('-') => {
                        audio_player.volume_down();
                        app.volume = audio_player.get_volume();
                        app.is_muted = false;
                    }
                    KeyCode::Char('/') => {
                        app.input_mode = InputMode::Search;
                    }
                    _ => {}
                },
                InputMode::Search => match key.code {
                    KeyCode::Enter | KeyCode::Esc => {
                        app.input_mode = InputMode::Normal;
                    }
                    KeyCode::Char(c) => {
                        app.search_query.push(c);
                        app.filter_tracks();
                    }
                    KeyCode::Backspace => {
                        app.search_query.pop();
                        app.filter_tracks();
                    }
                    _ => {}
                },
            }
        }

        if last_tick.elapsed() >= tick_rate {
            // Tick events (Timer countdown, end of track check)
            if let Some(mut timer) = app.sleep_timer {
                if timer == 0 {
                    app.should_quit = true;
                } else {
                    timer = timer.saturating_sub(1);
                    app.sleep_timer = Some(timer);
                }
            }

            // Check if track ended
            if app.is_playing && audio_player.is_empty() {
                if app.play_next_track() {
                    if let Some(track) = &app.current_track {
                        audio_player.play_hls(&app.server_url, &track.url, track.segment_duration);
                        app.is_playing = true;
                    }
                } else {
                    app.is_playing = false;
                }
            }

            last_tick = Instant::now();
        }

        if app.should_quit {
            break;
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}
