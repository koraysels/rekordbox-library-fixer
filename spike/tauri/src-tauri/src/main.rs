use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use tauri::http::{header, Response, StatusCode};
use tauri::Manager;

// Release builds get the key from the REKORDBOX_DB_KEY secret at compile time; it is never in the repo.
const DB_KEY: Option<&str> = option_env!("REKORDBOX_DB_KEY");

fn db_key() -> Option<&'static str> {
    DB_KEY.filter(|k| k.len() == 64).or(option_env!("SPIKE_DB_KEY"))
}

struct Sidecar { _child: Child, stdin: ChildStdin, stdout: BufReader<ChildStdout> }
struct Backends { node: Mutex<Sidecar>, py: Mutex<Sidecar> }

fn spawn(path: PathBuf) -> Result<Sidecar, String> {
    let mut cmd = Command::new(&path);
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = cmd.spawn().map_err(|e| format!("could not start {}: {e}", path.display()))?;
    let stdin = child.stdin.take().unwrap();
    let stdout = BufReader::new(child.stdout.take().unwrap());
    Ok(Sidecar { _child: child, stdin, stdout })
}

fn ask(s: &Mutex<Sidecar>, line: String) -> Result<String, String> {
    let mut s = s.lock().map_err(|_| "sidecar lock poisoned".to_string())?;
    writeln!(s.stdin, "{line}").map_err(|e| format!("sidecar stopped: {e}"))?;
    s.stdin.flush().map_err(|e| e.to_string())?;
    let mut out = String::new();
    let n = s.stdout.read_line(&mut out).map_err(|e| e.to_string())?;
    if n == 0 { return Err("sidecar closed its output".into()); }
    Ok(out)
}

#[tauri::command]
fn rpc(state: tauri::State<Backends>, target: String, line: String) -> Result<String, String> {
    let t0 = std::time::Instant::now();
    let out = if target == "py" { ask(&state.py, line)? } else { ask(&state.node, line)? };
    Ok(format!("{{\"ms\":{},\"reply\":{}}}", t0.elapsed().as_millis(), out.trim()))
}

fn db_candidates() -> Vec<String> {
    let mut v = Vec::new();
    if cfg!(target_os = "macos") {
        if let Ok(h) = std::env::var("HOME") { v.push(format!("{h}/Library/Pioneer/rekordbox/master.db")); }
    } else if cfg!(windows) {
        if let Ok(a) = std::env::var("APPDATA") { v.push(format!("{a}\\Pioneer\\rekordbox\\master.db")); }
    }
    v
}

#[tauri::command]
fn check_library(state: tauri::State<Backends>) -> Result<String, String> {
    let Some(key) = db_key() else {
        return Ok(r#"{"reply":{"result":{"found":false,"reason":"this build has no database key"}}}"#.into());
    };
    let req = serde_json::json!({"id": 10, "method": "check", "params": {"candidates": db_candidates(), "key": key}});
    rpc(state, "py".into(), req.to_string())
}

#[tauri::command]
fn sys_info(app: tauri::AppHandle) -> serde_json::Value {
    serde_json::json!({
        "app": app.package_info().version.to_string(),
        "os": std::env::consts::OS, "arch": std::env::consts::ARCH,
        "keyBundled": db_key().is_some(),
    })
}

#[tauri::command]
fn spike_env() -> serde_json::Value {
    serde_json::json!({
        "mp3": std::env::var("SPIKE_MP3").unwrap_or_default(),
        "aif": std::env::var("SPIKE_AIF").unwrap_or_default(),
        "ui": std::env::var("SPIKE_UI").is_ok(),
        "check": std::env::var("SPIKE_CHECK").is_ok(),
    })
}

#[tauri::command]
fn report(msg: String) { println!("SPIKE {msg}"); }

// media://localhost/<percent-encoded absolute path>, with Range support so <audio> can seek.
fn media(req: &tauri::http::Request<Vec<u8>>) -> Response<Vec<u8>> {
    let not_found = || Response::builder().status(StatusCode::NOT_FOUND).body(vec![]).unwrap();
    let mut path = percent_decode(req.uri().path());
    // Windows: /C:/x -> C:/x
    if path.len() > 2 && path.as_bytes()[2] == b':' { path.remove(0); }
    let Ok(mut f) = std::fs::File::open(&path) else { return not_found() };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    if len == 0 { return not_found(); }
    let lower = path.to_lowercase();
    let mime = if lower.ends_with(".mp3") { "audio/mpeg" } else if lower.ends_with(".wav") { "audio/wav" }
        else if lower.ends_with(".aif") || lower.ends_with(".aiff") { "audio/aiff" }
        else if lower.ends_with(".m4a") || lower.ends_with(".mp4") { "audio/mp4" }
        else if lower.ends_with(".flac") { "audio/flac" } else { "application/octet-stream" };
    let range = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("bytes="))
        .map(|r| {
            let mut p = r.splitn(2, '-');
            let a: u64 = p.next().unwrap_or("0").parse().unwrap_or(0);
            let b: u64 = p.next().and_then(|x| x.parse().ok()).unwrap_or(len - 1);
            (a.min(len - 1), b.min(len - 1).min(a + 4 * 1024 * 1024))
        });
    let (start, end, partial) = match range { Some((a, b)) => (a, b, true), None => (0, len - 1, false) };
    let mut buf = vec![0u8; (end - start + 1) as usize];
    if f.seek(SeekFrom::Start(start)).is_err() || f.read_exact(&mut buf).is_err() { return not_found(); }
    let mut r = Response::builder()
        .status(if partial { StatusCode::PARTIAL_CONTENT } else { StatusCode::OK })
        .header(header::CONTENT_TYPE, mime).header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, buf.len().to_string()).header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    if partial { r = r.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}")); }
    r.body(buf).unwrap()
}

// Linux: WebKitGTK hands <audio> to GStreamer, which cannot read a custom scheme, so audio is
// served from 127.0.0.1 instead. The random token keeps other local programs out.
struct MediaServer { base: String }

fn start_media_server() -> std::io::Result<MediaServer> {
    use std::hash::{BuildHasher, Hasher};
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let token = format!("{:016x}{:016x}", h.finish(), std::collections::hash_map::RandomState::new().build_hasher().finish());
    let prefix = format!("/{token}");
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let prefix = prefix.clone();
            std::thread::spawn(move || { let _ = serve(stream, &prefix); });
        }
    });
    Ok(MediaServer { base: format!("http://127.0.0.1:{port}/{token}") })
}

fn serve(mut stream: std::net::TcpStream, prefix: &str) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    loop {
        let mut request_line = String::new();
        if reader.read_line(&mut request_line)? == 0 { return Ok(()); }
        let mut range_header = None;
        loop {
            let mut l = String::new();
            if reader.read_line(&mut l)? == 0 || l == "\r\n" || l == "\n" { break; }
            if let Some((k, v)) = l.split_once(':') {
                if k.eq_ignore_ascii_case("range") { range_header = Some(v.trim().to_string()); }
            }
        }
        let target = request_line.split_whitespace().nth(1).unwrap_or("");
        let Some(rest) = target.strip_prefix(prefix) else {
            stream.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")?; continue;
        };
        let mut req = tauri::http::Request::builder().uri(format!("http://x{rest}"));
        if let Some(r) = &range_header { req = req.header(header::RANGE, r.as_str()); }
        let resp = media(&req.body(Vec::new()).unwrap());
        let mut head = format!("HTTP/1.1 {} {}\r\n", resp.status().as_u16(), resp.status().canonical_reason().unwrap_or(""));
        for (k, v) in resp.headers() { head.push_str(&format!("{}: {}\r\n", k, v.to_str().unwrap_or(""))); }
        head.push_str("\r\n");
        stream.write_all(head.as_bytes())?;
        stream.write_all(resp.body())?;
    }
}

#[tauri::command]
fn media_base(state: tauri::State<MediaServer>) -> String {
    if cfg!(target_os = "linux") || std::env::var("SPIKE_HTTP").is_ok() { state.base.clone() }
    else if cfg!(windows) { "http://media.localhost".into() } else { "media://localhost".into() }
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 3 <= b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) { out.push(v); i += 3; continue; }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let exe_dir = std::env::current_exe()?.parent().unwrap().to_path_buf();
            let res = app.path().resource_dir()?;
            let node = spawn(exe_dir.join(if cfg!(windows) { "backend.exe" } else { "backend" }))?;
            let py = Mutex::new(spawn(res.join("rbdb").join(if cfg!(windows) { "rbdb.exe" } else { "rbdb" }))?);
            if let (Ok(db), Ok(kf)) = (std::env::var("SPIKE_DB"), std::env::var("SPIKE_KEY_FILE")) {
                let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(kf)?)?;
                let open = serde_json::json!({"id": 0, "method": "open", "params": {"path": db, "key": v["key"]}});
                let t0 = std::time::Instant::now();
                let r = ask(&py, open.to_string())?;
                println!("SPIKE py open {}ms ok={}", t0.elapsed().as_millis(), r.contains("result"));
            }
            app.manage(Backends { node: Mutex::new(node), py });
            app.manage(start_media_server()?);
            Ok(())
        })
        .register_uri_scheme_protocol("media", |_ctx, req| media(&req))
        .invoke_handler(tauri::generate_handler![rpc, report, spike_env, sys_info, check_library, media_base])
        .run(tauri::generate_context!())
        .expect("run");
}
