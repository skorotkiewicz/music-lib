use ratatui::{
    Frame,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph},
};

use crate::app::{App, InputMode, RepeatMode};

pub fn draw(f: &mut Frame, app: &mut App, audio_player: &crate::audio::AudioPlayer) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Length(3), // Search Input
            Constraint::Min(0),    // Track List
            Constraint::Length(1), // Progress
            Constraint::Length(4), // Footer / Controls
        ])
        .split(f.area());

    draw_header(f, app, chunks[0]);
    draw_search(f, app, chunks[1]);
    draw_list(f, app, chunks[2]);
    draw_progress(f, app, audio_player, chunks[3]);
    draw_footer(f, app, chunks[4]);
}

fn format_time(secs: u64) -> String {
    format!("{}:{:02}", secs / 60, secs % 60)
}

fn draw_progress(f: &mut Frame, app: &App, audio_player: &crate::audio::AudioPlayer, area: Rect) {
    use ratatui::widgets::Gauge;

    if app.is_playing || app.current_track.is_some() {
        if let Some(track) = &app.current_track {
            let total_secs = (track.total_segments as f64 * track.segment_duration as f64) as u64;
            let mut curr_secs = audio_player.get_global_pos().as_secs();
            if curr_secs > total_secs && total_secs > 0 {
                curr_secs = total_secs;
            }

            let total_str = format_time(total_secs);
            let curr_str = format_time(curr_secs);

            let ratio = if total_secs > 0 {
                (curr_secs as f64 / total_secs as f64).clamp(0.0, 1.0)
            } else {
                0.0
            };

            let label = format!("[{}] {} [{}]", curr_str, track.title, total_str);

            let progress_widget = Gauge::default()
                .gauge_style(Style::default().fg(Color::Cyan).bg(Color::DarkGray))
                .ratio(ratio)
                .label(label);
            f.render_widget(progress_widget, area);
        }
    } else {
        let dummy = Gauge::default()
            .gauge_style(Style::default().fg(Color::DarkGray))
            .ratio(0.0)
            .label("[0:00] - [----]");
        f.render_widget(dummy, area);
    }
}

fn draw_header(f: &mut Frame, app: &App, area: Rect) {
    let title = format!(" 🎵 Music Library [{}] ", app.server_url);

    let mut status_spans = Vec::new();

    if app.is_playing {
        status_spans.push(Span::styled(
            " [PLAYING] ",
            Style::default()
                .fg(Color::Green)
                .add_modifier(Modifier::BOLD),
        ));
    } else if app.current_track.is_some() {
        status_spans.push(Span::styled(
            " [PAUSED] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ));
    } else {
        status_spans.push(Span::styled(" [STOPPED] ", Style::default().fg(Color::Red)));
    }

    status_spans.push(Span::raw(format!(" Vol: {:.0}% ", app.volume * 100.0)));

    if app.is_muted {
        status_spans.push(Span::styled(" [MUTED]", Style::default().fg(Color::Red)));
    }
    if app.shuffle_mode {
        status_spans.push(Span::styled(" [SHUFFLE]", Style::default().fg(Color::Cyan)));
    }

    let repeat_str = match app.repeat_mode {
        RepeatMode::Off => "",
        RepeatMode::All => " [REPEAT: ALL]",
        RepeatMode::One => " [REPEAT: ONE]",
    };
    if !repeat_str.is_empty() {
        status_spans.push(Span::styled(
            repeat_str,
            Style::default().fg(Color::Magenta),
        ));
    }

    if let Some(timer) = app.sleep_timer {
        let hours = timer / 3600;
        let minutes = (timer % 3600) / 60;
        let seconds = timer % 60;

        let time_str = if hours > 0 {
            format!("{}h {}m {}s", hours, minutes, seconds)
        } else if minutes > 0 {
            format!("{}m {}s", minutes, seconds)
        } else {
            format!("{}s", seconds)
        };

        status_spans.push(Span::styled(
            format!(" [TIMER: {}]", time_str),
            Style::default().fg(Color::LightBlue),
        ));
    }

    let header_line = Line::from(status_spans);

    let block = Block::default()
        .borders(Borders::ALL)
        .title(title)
        .style(Style::default().fg(Color::White));

    let header_widget = Paragraph::new(header_line).block(block);
    f.render_widget(header_widget, area);
}

fn draw_search(f: &mut Frame, app: &App, area: Rect) {
    let mode_str = match app.input_mode {
        InputMode::Normal => " (Press '/' to search)",
        InputMode::Search => " (Editing - Press Esc or Enter to finish)",
    };

    let title = format!(" Search / Filter{} ", mode_str);
    let border_color = match app.input_mode {
        InputMode::Normal => Color::White,
        InputMode::Search => Color::Yellow,
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .title(title)
        .style(Style::default().fg(border_color));

    let search_widget = Paragraph::new(app.search_query.as_str()).block(block);
    f.render_widget(search_widget, area);
}

fn draw_list(f: &mut Frame, app: &mut App, area: Rect) {
    let items: Vec<ListItem> = app
        .filtered_tracks
        .iter()
        .enumerate()
        .map(|(i, t)| {
            let mut style = Style::default().fg(Color::White);
            let mut prefix = "  ";

            if let Some(curr_idx) = app.current_track_index {
                // If it is playing and selected
                if curr_idx == i && app.current_track.as_ref().is_some_and(|ct| ct.id == t.id) {
                    style = style.fg(Color::Green).add_modifier(Modifier::BOLD);
                    prefix = "▶ ";
                }
            }

            let content = format!(
                "{}{} ({} plays, {} seg)",
                prefix, t.title, t.listen_count, t.total_segments
            );
            ListItem::new(content).style(style)
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title(" Tracks "))
        .highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol(">> ");

    f.render_stateful_widget(list, area, &mut app.list_state);
}

fn draw_footer(f: &mut Frame, _app: &App, area: Rect) {
    let instructions = vec![
        Line::from(vec![
            Span::raw(" Space: Play/Pause | "),
            Span::raw(" Up/Down, k/j: Navigate | "),
            Span::raw(" Enter: Select | "),
            Span::raw(" Left/Right: Prev/Next track | "),
            Span::raw(" +/-: Vol "),
        ]),
        Line::from(vec![
            Span::raw(" a/d: Seek 5s | "),
            Span::raw(" M: Mute | "),
            Span::raw(" S: Shuffle | "),
            Span::raw(" R: Repeat | "),
            Span::raw(" T: Sleep Timer | "),
            Span::raw(" Q: Quit"),
        ]),
    ];

    let block = Block::default().borders(Borders::ALL).title(" Controls ");

    let paragraph = Paragraph::new(instructions).block(block);
    f.render_widget(paragraph, area);
}
