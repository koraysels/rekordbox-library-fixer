use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use tauri::http::{header, Response, StatusCode};

struct Sidecar { _child: Child, stdin: ChildStdin, stdout: BufReader<ChildStdout> }
struct Backends { node: Mutex<Sidecar>, py: Mutex<Sidecar> }

fn spawn(path: std::path::PathBuf) -> Sidecar {
    let mut child = Command::new(&path).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn()
        .unwrap_or_else(|e| panic!("spawn {path:?}: {e}"));
    let stdin = child.stdin.take().unwrap();
    let stdout = BufReader::new(child.stdout.take().unwrap());
    Sidecar { _child: child, stdin, stdout }
}

fn ask(s: &Mutex<Sidecar>, line: String) -> String {
    let mut s = s.lock().unwrap();
    writeln!(s.stdin, "{line}").unwrap();
    s.stdin.flush().unwrap();
    let mut out = String::new();
    s.stdout.read_line(&mut out).unwrap();
    out
}

#[tauri::command]
fn spike_env() -> serde_json::Value {
    serde_json::json!({"mp3": std::env::var("SPIKE_MP3").unwrap_or_default(), "aif": std::env::var("SPIKE_AIF").unwrap_or_default(), "ui": std::env::var("SPIKE_UI").is_ok()})
}

#[tauri::command]
fn report(msg: String) { println!("SPIKE {msg}"); }

#[tauri::command]
fn rpc(state: tauri::State<Backends>, target: String, line: String) -> String {
    let t0 = std::time::Instant::now();
    let out = if target == "py" { ask(&state.py, line) } else { ask(&state.node, line) };
    format!("{{\"ms\":{},\"reply\":{}}}", t0.elapsed().as_millis(), out.trim())
}

// media://localhost/<percent-encoded absolute path>, with Range support so <audio> can seek.
fn media(req: &tauri::http::Request<Vec<u8>>) -> Response<Vec<u8>> {
    let raw = req.uri().path();
    let mut path = percent_decode(raw);
    // Windows: /C:/x -> C:/x
    if path.len() > 2 && path.as_bytes()[2] == b':' { path.remove(0); }
    let Ok(mut f) = std::fs::File::open(&path) else {
        return Response::builder().status(StatusCode::NOT_FOUND).body(vec![]).unwrap();
    };
    let len = f.metadata().unwrap().len();
    let mime = if path.ends_with(".mp3") { "audio/mpeg" } else if path.ends_with(".wav") { "audio/wav" }
        else if path.ends_with(".aif") || path.ends_with(".aiff") { "audio/aiff" } else { "application/octet-stream" };
    let range = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("bytes="))
        .map(|r| { let mut p = r.splitn(2, '-');
            let a: u64 = p.next().unwrap_or("0").parse().unwrap_or(0);
            let b: u64 = p.next().and_then(|x| x.parse().ok()).unwrap_or(len - 1);
            (a, b.min(len - 1).min(a + 4 * 1024 * 1024)) });
    let (start, end, status) = match range { Some((a, b)) => (a, b, StatusCode::PARTIAL_CONTENT), None => (0, len - 1, StatusCode::OK) };
    let mut buf = vec![0u8; (end - start + 1) as usize];
    f.seek(SeekFrom::Start(start)).unwrap();
    f.read_exact(&mut buf).unwrap();
    let mut b = Response::builder().status(status).header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes").header(header::CONTENT_LENGTH, buf.len().to_string());
    if status == StatusCode::PARTIAL_CONTENT { b = b.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}")); }
    b.body(buf).unwrap()
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes(); let mut out = Vec::with_capacity(bytes.len()); let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() + 0 && i + 2 <= bytes.len() - 1 {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) { out.push(v); i += 3; continue; }
        }
        out.push(bytes[i]); i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            let exe_dir = std::env::current_exe()?.parent().unwrap().to_path_buf();
            let res = app.path().resource_dir()?;
            let py = Mutex::new(spawn(res.join("rbdb").join(if cfg!(windows) { "rbdb.exe" } else { "rbdb" })));
            if let (Ok(db), Ok(kf)) = (std::env::var("SPIKE_DB"), std::env::var("SPIKE_KEY_FILE")) {
                let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(kf)?)?;
                let open = serde_json::json!({"id": 0, "method": "open", "params": {"path": db, "key": v["key"]}});
                let t0 = std::time::Instant::now();
                let r = ask(&py, open.to_string());
                println!("SPIKE py open {}ms ok={}", t0.elapsed().as_millis(), r.contains("result"));
            }
            app.manage(Backends { node: Mutex::new(spawn(exe_dir.join(if cfg!(windows) { "backend.exe" } else { "backend" }))), py });
            Ok(())
        })
        .register_uri_scheme_protocol("media", |_ctx, req| media(&req))
        .invoke_handler(tauri::generate_handler![rpc, report, spike_env])
        .run(tauri::generate_context!())
        .expect("run");
}
