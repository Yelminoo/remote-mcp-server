import { Router } from "express";
import { SERVICE_NAME } from "../constants.js";

export function createDashboardRouter(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildDashboard(SERVICE_NAME));
  });
  return router;
}

function buildDashboard(serviceName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${serviceName} &#8212; MCP Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d1117; --surface: #161b22; --surface2: #1c2128; --border: #30363d;
      --text: #e6edf3; --muted: #7d8590;
      --green: #3fb950; --yellow: #d29922; --red: #f85149; --blue: #58a6ff; --purple: #bc8cff;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      --mono: 'SF Mono', 'Cascadia Code', Consolas, monospace;
    }
    body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; padding: 24px 32px; }

    /* ── Header ── */
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { width: 38px; height: 38px; background: linear-gradient(135deg, #58a6ff, #bc8cff); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; }
    .logo-title { font-size: 18px; font-weight: 600; letter-spacing: -0.2px; }
    .logo-sub { font-size: 12px; color: var(--muted); margin-top: 1px; font-family: var(--mono); }
    .header-right { display: flex; align-items: center; gap: 10px; }
    .live-badge { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); margin-right: 4px; }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 7px var(--green); animation: pulse 2.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .updated { font-size: 12px; color: var(--muted); font-family: var(--mono); }
    .btn-icon { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--muted); cursor: pointer; font-size: 14px; padding: 6px 11px; transition: background .15s, color .15s, border-color .15s; }
    .btn-icon:hover { background: var(--border); color: var(--text); }
    .btn-icon.active { color: var(--blue); border-color: var(--blue); background: #0c1f3a; }

    /* ── Credential banner ── */
    .cred-banner { background: #1a1200; border: 1px solid #4d3800; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .cred-banner-text { font-size: 13px; color: var(--yellow); }
    .cred-banner-text strong { color: #f0c040; }
    .btn-setup { background: #4d3800; border: 1px solid #7a5a00; border-radius: 7px; color: #f0c040; cursor: pointer; font-size: 12px; font-weight: 600; padding: 6px 14px; white-space: nowrap; }
    .btn-setup:hover { background: #664d00; }

    /* ── Credentials panel ── */
    .creds-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
    .creds-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .creds-title { font-size: 14px; font-weight: 600; }
    .creds-body { padding: 20px; }
    .creds-source-note { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
    .creds-source-note.env-note { color: var(--green); }
    .creds-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .creds-label { font-size: 12px; color: var(--muted); width: 72px; flex-shrink: 0; }
    .creds-val { font-family: var(--mono); font-size: 12px; color: var(--text); background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; flex: 1; }
    .creds-form { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .form-label a { color: var(--blue); text-decoration: none; font-weight: normal; text-transform: none; letter-spacing: 0; }
    .form-label a:hover { text-decoration: underline; }
    .input-wrap { display: flex; gap: 6px; }
    .form-input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--mono); font-size: 13px; padding: 8px 12px; outline: none; transition: border-color .15s; }
    .form-input:focus { border-color: var(--blue); }
    .form-input::placeholder { color: var(--muted); opacity: .6; }
    .btn-eye { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--muted); cursor: pointer; font-size: 14px; padding: 8px 10px; }
    .btn-eye:hover { background: var(--border); color: var(--text); }
    .form-actions { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .btn { border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 18px; transition: opacity .15s; }
    .btn:disabled { opacity: .45; cursor: not-allowed; }
    .btn-primary { background: var(--blue); color: #000; }
    .btn-primary:hover:not(:disabled) { opacity: .85; }
    .btn-ghost { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
    .btn-ghost:hover:not(:disabled) { background: var(--border); }
    .btn-danger { background: #4d1010; border: 1px solid var(--red); color: var(--red); }
    .feedback { font-size: 13px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; display: none; }
    .feedback.ok  { background: #0a2415; color: var(--green); border: 1px solid #1a4d2e; }
    .feedback.err { background: #260808; color: var(--red);   border: 1px solid #4d1010; }

    /* ── Stat cards ── */
    .cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    @media(max-width:900px){ .cards{grid-template-columns:repeat(2,1fr)} }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; position: relative; overflow: hidden; }
    .card-accent { position: absolute; top:0;left:0;right:0;height:2px;border-radius:12px 12px 0 0; }
    .c-blue   .card-accent { background: linear-gradient(90deg,var(--blue)   0%,transparent 70%); }
    .c-red    .card-accent { background: linear-gradient(90deg,var(--red)    0%,transparent 70%); }
    .c-green  .card-accent { background: linear-gradient(90deg,var(--green)  0%,transparent 70%); }
    .c-purple .card-accent { background: linear-gradient(90deg,var(--purple) 0%,transparent 70%); }
    .card-label { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:10px; }
    .card-val   { font-size:34px;font-weight:700;font-family:var(--mono);line-height:1;margin-bottom:5px; }
    .c-blue   .card-val { color:var(--blue); }
    .c-red    .card-val { color:var(--red); }
    .c-green  .card-val { color:var(--green); }
    .c-purple .card-val { color:var(--purple); }
    .card-hint { font-size:12px;color:var(--muted); }

    /* ── Panels ── */
    .panel { background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:20px;overflow:hidden; }
    .panel-header { display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border); }
    .panel-title { font-size:14px;font-weight:600; }
    .badge { font-size:11px;font-family:var(--mono);background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 9px;color:var(--muted); }

    /* ── Endpoint analytics rows ── */
    .ep-grid { display:grid;grid-template-columns:88px 1fr 80px 80px 100px;align-items:center; }
    .ep-head { padding:8px 20px 6px;border-bottom:1px solid var(--border);background:var(--surface2); }
    .ep-head span { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--muted); }
    .ep-row { padding:10px 20px;border-bottom:1px solid rgba(48,54,61,.5);transition:background .12s; }
    .ep-row:last-child { border-bottom:none; }
    .ep-row:hover { background:var(--surface2); }

    /* ── Method badges (shared by analytics + tester) ── */
    .m-badge { font-size:11px;font-weight:700;font-family:var(--mono);padding:3px 8px;border-radius:5px;display:inline-block;white-space:nowrap; }
    .m-GET    { background:#0a2415;color:var(--green); border:1px solid #1a4d2e; }
    .m-POST   { background:#091830;color:var(--blue);  border:1px solid #163360; }
    .m-PUT    { background:#261a08;color:var(--yellow);border:1px solid #4d3010; }
    .m-PATCH  { background:#261a08;color:var(--yellow);border:1px solid #4d3010; }
    .m-DELETE { background:#260808;color:var(--red);   border:1px solid #4d1010; }
    .m-MCP    { background:#1a0826;color:var(--purple);border:1px solid #351050; }
    .m-OTHER  { background:var(--surface2);color:var(--muted);border:1px solid var(--border); }

    .ep-path-cell { display:flex;flex-direction:column;gap:5px;overflow:hidden; }
    .ep-path  { font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .ep-bar-track { height:3px;background:var(--surface2);border-radius:2px;overflow:hidden; }
    .ep-bar-fill  { height:100%;background:var(--blue);border-radius:2px;transition:width .4s ease; }
    .ep-bar-fill.err { background:linear-gradient(90deg,var(--blue) 0%,var(--red) 100%); }
    .ep-num { font-family:var(--mono);font-size:12px;color:var(--muted);text-align:right; }
    .ep-ago { font-size:11px;color:var(--muted);text-align:right; }

    /* ── Recent requests table ── */
    table { width:100%;border-collapse:collapse; }
    th { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);padding:8px 20px;text-align:left;border-bottom:1px solid var(--border);background:var(--surface2); }
    td { padding:9px 20px;font-size:13px;border-bottom:1px solid rgba(48,54,61,.4); }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:var(--surface2); }
    .mono { font-family:var(--mono);font-size:12px;color:var(--muted); }
    .s-chip { font-family:var(--mono);font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px; }
    .s2xx{background:#0a2415;color:var(--green)} .s3xx{background:#091830;color:var(--blue)}
    .s4xx{background:#261a08;color:var(--yellow)} .s5xx{background:#260808;color:var(--red)}

    /* ── API Tester ── */
    .tester-ep { border-bottom: 1px solid rgba(48,54,61,.5); }
    .tester-ep:last-child { border-bottom: none; }
    .tester-ep-hdr { display: flex; align-items: center; gap: 12px; padding: 11px 20px; cursor: pointer; transition: background .12s; user-select: none; }
    .tester-ep-hdr:hover { background: var(--surface2); }
    .tester-ep-hdr.open { background: var(--surface2); }
    .tester-tpath { font-family: var(--mono); font-size: 12.5px; flex: 1; }
    .tester-desc  { font-size: 12px; color: var(--muted); }
    .chevron { color: var(--muted); font-size: 10px; flex-shrink: 0; transition: transform .2s; }
    .chevron.open { transform: rotate(90deg); }
    .tester-form { padding: 16px 20px 20px; border-top: 1px solid var(--border); background: #12171e; }
    .tester-group { margin-bottom: 11px; }
    .tester-lbl { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin-bottom: 5px; }
    .param-in { font-size: 10px; color: var(--muted); text-transform: none; letter-spacing: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; margin-left: 4px; }
    .param-req { color: var(--red); margin-left: 2px; }
    .tester-input { width: 100%; max-width: 520px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-family: var(--mono); font-size: 12px; padding: 7px 10px; outline: none; transition: border-color .15s; }
    .tester-input:focus { border-color: var(--blue); }
    select.tester-input { cursor: pointer; }
    .no-params { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
    .tester-actions { margin-top: 14px; display: flex; align-items: center; gap: 10px; }
    .tester-resp { margin-top: 14px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .resp-meta { display: flex; align-items: center; gap: 10px; padding: 7px 12px; background: var(--surface2); border-bottom: 1px solid var(--border); }
    .resp-ms { font-family: var(--mono); font-size: 11px; color: var(--muted); }
    .resp-body { font-family: var(--mono); font-size: 11.5px; line-height: 1.6; padding: 12px; background: #080b10; color: #c9d1d9; max-height: 320px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }

    .empty { padding:44px 20px;text-align:center;color:var(--muted);font-size:13px; }
    .empty-icon { font-size:28px;margin-bottom:10px;opacity:.35; }

    /* ── Connection Info panel ── */
    .conn-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:900px){ .conn-grid{grid-template-columns:1fr} }
    .conn-block { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
    .conn-block-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; }
    .conn-url-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
    .conn-url-val { font-family:var(--mono); font-size:12px; color:var(--blue); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .conn-code { font-family:var(--mono); font-size:10.5px; background:#080b10; border:1px solid var(--border); border-radius:6px; padding:10px 12px; color:#c9d1d9; white-space:pre; overflow:auto; max-height:160px; }
    .btn-copy { font-size:10px; font-weight:600; background:var(--surface); border:1px solid var(--border); border-radius:5px; color:var(--muted); cursor:pointer; padding:2px 8px; white-space:nowrap; }
    .btn-copy:hover { background:var(--border); color:var(--text); }
    .auth-badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 9px; border-radius:20px; }
    .auth-ok   { background:#0a2415; color:var(--green); border:1px solid #1a4d2e; }
    .auth-warn { background:#261a08; color:var(--yellow); border:1px solid #4d3010; }
    @media(max-width:768px){
      body{padding:16px}
      .ep-grid{grid-template-columns:72px 1fr 60px}
      .ep-head>:nth-child(n+4),.ep-row>:nth-child(n+4){display:none}
      .tester-desc{display:none}
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <div class="logo-icon">&#9889;</div>
      <div>
        <div class="logo-title">MCP Dashboard</div>
        <div class="logo-sub">${serviceName}-mcp-server</div>
      </div>
    </div>
    <div class="header-right">
      <div class="live-badge">
        <div class="live-dot" id="liveDot"></div>
        <span id="liveText">Connecting&#8230;</span>
      </div>
      <div class="updated" id="updatedAt">&#8212;</div>
      <button class="btn-icon" id="settingsBtn" title="Credentials">&#9881;</button>
    </div>
  </header>

  <div class="cred-banner" id="credBanner" style="display:none">
    <span class="cred-banner-text"><strong>&#9888; Credentials not configured.</strong> Trello calls will fail until you set them.</span>
    <button class="btn-setup" id="bannerSetupBtn">Configure now</button>
  </div>

  <div class="creds-panel" id="credsPanel" style="display:none">
    <div class="creds-header">
      <span class="creds-title">&#128273; Credentials</span>
      <span class="badge" id="credsSourceBadge">&#8212;</span>
    </div>
    <div class="creds-body" id="credsBody">
      <div class="empty"><div class="empty-icon">&#8987;</div>Loading&#8230;</div>
    </div>
  </div>

  <div class="cards">
    <div class="card c-blue"><div class="card-accent"></div>
      <div class="card-label">Total Requests</div>
      <div class="card-val" id="cTotal">&#8212;</div>
      <div class="card-hint">since startup</div>
    </div>
    <div class="card c-red"><div class="card-accent"></div>
      <div class="card-label">Error Rate</div>
      <div class="card-val" id="cErrors">&#8212;</div>
      <div class="card-hint" id="cErrorCount">&#8212; errors total</div>
    </div>
    <div class="card c-green"><div class="card-accent"></div>
      <div class="card-label">Avg Latency</div>
      <div class="card-val" id="cAvg">&#8212;</div>
      <div class="card-hint" id="cP95">p95: &#8212;</div>
    </div>
    <div class="card c-purple"><div class="card-accent"></div>
      <div class="card-label">Uptime</div>
      <div class="card-val" id="cUptime">&#8212;</div>
      <div class="card-hint">server running</div>
    </div>
  </div>

  <div class="panel" id="connPanel">
    <div class="panel-header">
      <span class="panel-title">&#128279; Connection Info</span>
      <span class="badge" id="connModeBadge">&#8212;</span>
    </div>
    <div id="connBody" style="padding:16px 20px">
      <div class="empty"><div class="empty-icon">&#8987;</div>Loading&#8230;</div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">Endpoints</span>
      <span class="badge" id="epCount">0</span>
    </div>
    <div class="ep-grid ep-head">
      <span>Method</span><span>Endpoint</span>
      <span style="text-align:right">Calls</span>
      <span style="text-align:right">Avg ms</span>
      <span style="text-align:right">Last seen</span>
    </div>
    <div id="epList"><div class="empty"><div class="empty-icon">&#128225;</div>No requests yet</div></div>
  </div>

  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">Recent Requests</span>
      <span class="badge" id="recentCount">0</span>
    </div>
    <table>
      <thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Duration</th></tr></thead>
      <tbody id="recentBody"><tr><td colspan="5" class="empty"><div class="empty-icon">&#128203;</div>No requests yet</td></tr></tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">&#128295; API Tester</span>
      <span class="badge" id="testerBadge">0 endpoints</span>
    </div>
    <div id="testerList"><div class="empty"><div class="empty-icon">&#8987;</div>Loading&#8230;</div></div>
  </div>

  <script>
    var API = '/api';

    /* ── Utilities ──────────────────────────── */
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtUptime(ms) {
      var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
      if(h>0)return h+'h '+m+'m'; if(m>0)return m+'m '+sec+'s'; return sec+'s';
    }
    function fmtTime(ts){return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
    function fmtAgo(ts){
      var s=Math.floor((Date.now()-ts)/1000);
      if(s<5)return 'just now'; if(s<60)return s+'s ago';
      if(s<3600)return Math.floor(s/60)+'m ago'; return Math.floor(s/3600)+'h ago';
    }
    function methodCls(m){return 'm-'+(['GET','POST','PUT','PATCH','DELETE','MCP'].indexOf(m)>=0?m:'OTHER');}
    function statusCls(s){if(s>=500)return 's5xx';if(s>=400)return 's4xx';if(s>=300)return 's3xx';return 's2xx';}
    function parseMethod(k){return k.split(' ')[0];}
    function parsePath(k){return k.indexOf(' ')>=0?k.slice(k.indexOf(' ')+1):k;}
    function setText(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}

    /* ── Metrics ────────────────────────────── */
    function updateCards(s){
      setText('cTotal',  s.totalRequests.toLocaleString());
      setText('cErrors', s.errorRate+'%');
      setText('cErrorCount',s.totalErrors.toLocaleString()+' errors total');
      setText('cAvg',   s.avgLatencyMs+'ms');
      setText('cP95',   'p95: '+s.p95LatencyMs+'ms');
      setText('cUptime',fmtUptime(s.uptimeMs));
    }
    function updateEndpoints(routes){
      setText('epCount',String(routes.length));
      var el=document.getElementById('epList');
      if(!routes.length){el.innerHTML='<div class="empty"><div class="empty-icon">&#128225;</div>No requests yet</div>';return;}
      var max=Math.max.apply(null,routes.map(function(r){return r.calls;})),html='';
      for(var i=0;i<routes.length;i++){
        var r=routes[i],method=parseMethod(r.key),path=parsePath(r.key);
        var pct=Math.round((r.calls/max)*100),errCls=r.errors>0?' err':'';
        html+='<div class="ep-grid ep-row">'+
          '<div><span class="m-badge '+methodCls(method)+'">'+esc(method)+'</span></div>'+
          '<div class="ep-path-cell"><span class="ep-path">'+esc(path)+'</span>'+
            '<div class="ep-bar-track"><div class="ep-bar-fill'+errCls+'" style="width:'+pct+'%"></div></div></div>'+
          '<div class="ep-num">'+r.calls.toLocaleString()+'</div>'+
          '<div class="ep-num">'+r.avgMs+'ms</div>'+
          '<div class="ep-ago">'+fmtAgo(r.lastCalledAt)+'</div>'+
        '</div>';
      }
      el.innerHTML=html;
    }
    function updateRecent(records){
      setText('recentCount',String(records.length));
      var body=document.getElementById('recentBody');
      if(!records.length){body.innerHTML='<tr><td colspan="5" class="empty"><div class="empty-icon">&#128203;</div>No requests yet</td></tr>';return;}
      var html='';
      for(var i=0;i<records.length;i++){
        var r=records[i];
        html+='<tr><td class="mono">'+fmtTime(r.ts)+'</td>'+
          '<td><span class="m-badge '+methodCls(r.method)+'">'+esc(r.method)+'</span></td>'+
          '<td class="mono">'+esc(r.path)+'</td>'+
          '<td><span class="s-chip '+statusCls(r.status)+'">'+r.status+'</span></td>'+
          '<td class="mono">'+r.durationMs+'ms</td></tr>';
      }
      body.innerHTML=html;
    }
    function setLive(ok){
      var dot=document.getElementById('liveDot'),text=document.getElementById('liveText');
      dot.style.background=ok?'var(--green)':'var(--red)';
      dot.style.boxShadow=ok?'0 0 7px var(--green)':'0 0 7px var(--red)';
      text.textContent=ok?'Live':'Disconnected';
    }
    async function refresh(){
      try{
        var sr=await fetch(API+'/metrics'),rr=await fetch(API+'/metrics/recent?n=30');
        if(!sr.ok||!rr.ok)throw new Error();
        var stats=await sr.json(),recent=await rr.json();
        updateCards(stats);updateEndpoints(stats.byRoute||[]);updateRecent(recent);setLive(true);
      }catch(e){setLive(false);}
      setText('updatedAt',new Date().toLocaleTimeString());
    }

    /* ── Credentials panel ──────────────────── */
    var credsPanelOpen=false;
    function showCredsPanel(open){
      credsPanelOpen=open;
      document.getElementById('credsPanel').style.display=open?'block':'none';
      document.getElementById('settingsBtn').classList.toggle('active',open);
      if(open)loadCredsStatus();
    }
    document.getElementById('settingsBtn').addEventListener('click',function(){showCredsPanel(!credsPanelOpen);});
    document.getElementById('bannerSetupBtn').addEventListener('click',function(){
      showCredsPanel(true);
      document.getElementById('credsPanel').scrollIntoView({behavior:'smooth',block:'start'});
    });
    async function loadCredsStatus(){
      try{
        var res=await fetch(API+'/credentials/status');
        var s=await res.json();
        renderCredsPanel(s);
        document.getElementById('credBanner').style.display=s.configured?'none':'flex';
      }catch(e){
        document.getElementById('credsBody').innerHTML='<div class="empty">Failed to load.</div>';
      }
    }
    function renderCredsPanel(s){
      var badge=document.getElementById('credsSourceBadge');
      if(s.source==='env'){badge.textContent='env vars';badge.style.color='var(--green)';}
      else if(s.source==='file'){badge.textContent='saved file';badge.style.color='var(--blue)';}
      else{badge.textContent='not set';badge.style.color='var(--red)';}
      var html='';
      if(s.configured){
        var noteClass=s.source==='env'?'creds-source-note env-note':'creds-source-note';
        var noteText=s.source==='env'
          ?'&#10003; Loaded from environment variables. Env vars always take priority.'
          :'&#10003; Loaded from ~/.trello-mcp/credentials.json (mode 0600).';
        html+='<div class="'+noteClass+'">'+noteText+'</div>';
        html+='<div class="creds-row"><span class="creds-label">API Key</span><span class="creds-val">'+esc(s.apiKeyMasked||'')+'</span></div>';
        html+='<div class="creds-row"><span class="creds-label">Token</span><span class="creds-val">'+esc(s.apiTokenMasked||'')+'</span></div>';
      }
      if(s.source==='env'){
        html+='<div class="creds-source-note" style="margin-top:10px">To change, update TRELLO_API_KEY and TRELLO_TOKEN and restart.</div>';
      }else{
        html+='<div class="creds-form">';
        html+='<div class="form-group"><label class="form-label">API Key &mdash; <a href="https://trello.com/app-key" target="_blank" rel="noopener">trello.com/app-key</a></label>';
        html+='<div class="input-wrap"><input class="form-input" type="password" id="inputApiKey" autocomplete="off" placeholder="32-char hex key" />';
        html+='<button class="btn-eye" data-for="inputApiKey">&#128065;</button></div></div>';
        html+='<div class="form-group"><label class="form-label">Token &mdash; <a href="https://trello.com/app-key" target="_blank" rel="noopener">click \'Generate a token\'</a></label>';
        html+='<div class="input-wrap"><input class="form-input" type="password" id="inputToken" autocomplete="off" placeholder="64-char hex token" />';
        html+='<button class="btn-eye" data-for="inputToken">&#128065;</button></div></div>';
        html+='<div class="form-actions">';
        html+='<button class="btn btn-ghost" id="btnTest">Test connection</button>';
        html+='<button class="btn btn-primary" id="btnSave">Save credentials</button>';
        html+='</div><div class="feedback" id="credsFeedback"></div></div>';
      }
      document.getElementById('credsBody').innerHTML=html;
      document.querySelectorAll('.btn-eye').forEach(function(b){
        b.addEventListener('click',function(){
          var inp=document.getElementById(b.getAttribute('data-for'));
          inp.type=inp.type==='password'?'text':'password';
        });
      });
      var saveBtn=document.getElementById('btnSave');
      if(saveBtn)saveBtn.addEventListener('click',saveCredentials);
      var testBtn=document.getElementById('btnTest');
      if(testBtn)testBtn.addEventListener('click',testCredentials);
    }
    function showFeedback(msg,ok){
      var el=document.getElementById('credsFeedback');
      if(!el)return;
      el.textContent=msg;el.className='feedback '+(ok?'ok':'err');el.style.display='block';
    }
    async function saveCredentials(){
      var ki=document.getElementById('inputApiKey'),ti=document.getElementById('inputToken');
      var apiKey=ki?ki.value.trim():'',apiToken=ti?ti.value.trim():'';
      if(!apiKey||!apiToken){showFeedback('Both fields are required.',false);return;}
      var btn=document.getElementById('btnSave');
      btn.disabled=true;btn.textContent='Saving…';
      try{
        var res=await fetch(API+'/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:apiKey,apiToken:apiToken})});
        var data=await res.json();
        if(!res.ok||!data.ok){showFeedback(data.error||'Save failed.',false);return;}
        if(ki)ki.value='';if(ti)ti.value='';
        showFeedback('Saved. Active immediately — no restart needed.',true);
        document.getElementById('credBanner').style.display='none';
        setTimeout(loadCredsStatus,600);
      }catch(e){showFeedback('Network error.',false);}
      finally{btn.disabled=false;btn.textContent='Save credentials';}
    }
    async function testCredentials(){
      var ki=document.getElementById('inputApiKey'),ti=document.getElementById('inputToken');
      var hasInputs=ki&&ki.value.trim()&&ti&&ti.value.trim();
      var btn=document.getElementById('btnTest');
      btn.disabled=true;btn.textContent='Testing…';
      try{
        if(hasInputs){
          var sr=await fetch(API+'/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:ki.value.trim(),apiToken:ti.value.trim()})});
          if(!sr.ok){showFeedback('Could not save before test.',false);return;}
        }
        var res=await fetch(API+'/credentials/test');
        var data=await res.json();
        if(data.ok){
          showFeedback('Connected as @'+data.username+' ('+data.fullName+')',true);
          if(ki)ki.value='';if(ti)ti.value='';
          loadCredsStatus();
        }else{showFeedback('Failed: '+data.error,false);}
      }catch(e){showFeedback('Network error.',false);}
      finally{btn.disabled=false;btn.textContent='Test connection';}
    }

    /* ── API Tester ─────────────────────────── */
    var ENDPOINTS = [
      {id:'get-me',      method:'GET',    path:'/api/me',              desc:'Get my Trello profile', params:[]},
      {id:'list-boards', method:'GET',    path:'/api/boards',          desc:'List boards',
        params:[{name:'filter',loc:'query',type:'select',opts:['open','closed','all'],def:'open'}]},
      {id:'get-board',   method:'GET',    path:'/api/boards/:id',      desc:'Get board + lists',
        params:[{name:'id',loc:'path',type:'text',ph:'Board ID',req:true}]},
      {id:'board-lists', method:'GET',    path:'/api/boards/:id/lists',desc:'Get lists on board',
        params:[{name:'id',loc:'path',type:'text',ph:'Board ID',req:true},{name:'filter',loc:'query',type:'select',opts:['open','closed','all'],def:'open'}]},
      {id:'board-cards', method:'GET',    path:'/api/boards/:id/cards',desc:'Get all cards on board',
        params:[{name:'id',loc:'path',type:'text',ph:'Board ID',req:true},{name:'filter',loc:'query',type:'select',opts:['open','closed','all'],def:'open'}]},
      {id:'list-cards',  method:'GET',    path:'/api/lists/:id/cards', desc:'Get cards in list',
        params:[{name:'id',loc:'path',type:'text',ph:'List ID',req:true},{name:'filter',loc:'query',type:'select',opts:['open','closed','all'],def:'open'}]},
      {id:'create-list', method:'POST',   path:'/api/lists',           desc:'Create list',
        params:[{name:'idBoard',loc:'body',type:'text',ph:'Board ID',req:true},{name:'name',loc:'body',type:'text',ph:'List name',req:true},{name:'pos',loc:'body',type:'select',opts:['bottom','top'],def:'bottom'}]},
      {id:'update-list', method:'PUT',    path:'/api/lists/:id',       desc:'Archive / rename list',
        params:[{name:'id',loc:'path',type:'text',ph:'List ID',req:true},{name:'name',loc:'body',type:'text',ph:'New name'},{name:'closed',loc:'body',type:'select',opts:['','true','false'],def:'',ph:'Archive?'}]},
      {id:'get-card',    method:'GET',    path:'/api/cards/:id',        desc:'Get card details',
        params:[{name:'id',loc:'path',type:'text',ph:'Card ID',req:true}]},
      {id:'create-card', method:'POST',   path:'/api/cards',            desc:'Create card',
        params:[{name:'idList',loc:'body',type:'text',ph:'List ID',req:true},{name:'name',loc:'body',type:'text',ph:'Card title',req:true},{name:'desc',loc:'body',type:'text',ph:'Description'},{name:'due',loc:'body',type:'text',ph:'2025-06-30T09:00:00Z'},{name:'pos',loc:'body',type:'select',opts:['bottom','top'],def:'bottom'}]},
      {id:'update-card', method:'PUT',    path:'/api/cards/:id',        desc:'Update card',
        params:[{name:'id',loc:'path',type:'text',ph:'Card ID',req:true},{name:'name',loc:'body',type:'text',ph:'New title'},{name:'desc',loc:'body',type:'text',ph:'New description'},{name:'due',loc:'body',type:'text',ph:'ISO date or blank to remove'},{name:'idList',loc:'body',type:'text',ph:'New list ID (move)'},{name:'closed',loc:'body',type:'select',opts:['','true','false'],def:'',ph:'Archive?'}]},
      {id:'delete-card', method:'DELETE', path:'/api/cards/:id',        desc:'Delete card permanently',
        params:[{name:'id',loc:'path',type:'text',ph:'Card ID',req:true}]},
      {id:'add-comment', method:'POST',   path:'/api/cards/:id/comments',desc:'Add comment',
        params:[{name:'id',loc:'path',type:'text',ph:'Card ID',req:true},{name:'text',loc:'body',type:'text',ph:'Comment text',req:true}]},
      {id:'search',      method:'GET',    path:'/api/search',           desc:'Search cards & boards',
        params:[{name:'q',loc:'query',type:'text',ph:'Search query',req:true},{name:'cards_limit',loc:'query',type:'text',ph:'10'},{name:'boards_limit',loc:'query',type:'text',ph:'5'}]},
      {id:'creds-status',method:'GET',    path:'/api/credentials/status',desc:'Credential status',params:[]},
      {id:'creds-test',  method:'GET',    path:'/api/credentials/test', desc:'Test Trello connection',params:[]},
    ];

    function renderTester(){
      setText('testerBadge', ENDPOINTS.length+' endpoints');
      var list=document.getElementById('testerList'),html='';
      for(var i=0;i<ENDPOINTS.length;i++){
        var ep=ENDPOINTS[i];
        html+='<div class="tester-ep">';
        html+='<div class="tester-ep-hdr" data-ep="'+ep.id+'">';
        html+='<span class="m-badge '+methodCls(ep.method)+'">'+ep.method+'</span>';
        html+='<span class="tester-tpath">'+ep.path+'</span>';
        html+='<span class="tester-desc">'+ep.desc+'</span>';
        html+='<span class="chevron" id="chev-'+ep.id+'">&#9654;</span>';
        html+='</div>';
        html+='<div class="tester-form" id="tform-'+ep.id+'" style="display:none">';
        if(ep.params.length===0){html+='<p class="no-params">No parameters.</p>';}
        else{
          for(var j=0;j<ep.params.length;j++){
            var p=ep.params[j];
            html+='<div class="tester-group">';
            html+='<label class="tester-lbl">'+p.name;
            if(p.loc) html+='<span class="param-in">'+p.loc+'</span>';
            if(p.req) html+='<span class="param-req">*</span>';
            html+='</label>';
            if(p.type==='select'){
              html+='<select class="tester-input" id="tp-'+ep.id+'-'+p.name+'">';
              for(var k=0;k<p.opts.length;k++){
                var o=p.opts[k];
                html+='<option value="'+esc(o)+'"'+(o===(p.def!==undefined?p.def:p.opts[0])?' selected':'')+'>'+(o===''?'&#8212; not set &#8212;':esc(o))+'</option>';
              }
              html+='</select>';
            }else{
              html+='<input class="tester-input" type="text" id="tp-'+ep.id+'-'+p.name+'" placeholder="'+(p.ph?esc(p.ph):'')+'" />';
            }
            html+='</div>';
          }
        }
        html+='<div class="tester-actions">';
        html+='<button class="btn btn-primary tester-send" data-ep="'+ep.id+'">Send &#9658;</button>';
        if(ep.method==='DELETE') html.replace('btn-primary','btn-primary btn-danger');
        html+='</div>';
        html+='<div class="tester-resp" id="tresp-'+ep.id+'" style="display:none"></div>';
        html+='</div></div>';
      }
      list.innerHTML=html;

      document.querySelectorAll('.tester-ep-hdr').forEach(function(hdr){
        hdr.addEventListener('click',function(){toggleEp(hdr.getAttribute('data-ep'));});
      });
      document.querySelectorAll('.tester-send').forEach(function(btn){
        btn.addEventListener('click',function(e){e.stopPropagation();sendTesterRequest(btn.getAttribute('data-ep'));});
      });
    }

    function toggleEp(id){
      var form=document.getElementById('tform-'+id);
      var chev=document.getElementById('chev-'+id);
      var hdr=document.querySelector('.tester-ep-hdr[data-ep="'+id+'"]');
      var isOpen=form.style.display!=='none';
      form.style.display=isOpen?'none':'block';
      chev.classList.toggle('open',!isOpen);
      if(hdr)hdr.classList.toggle('open',!isOpen);
    }

    async function sendTesterRequest(epId){
      var ep=null;
      for(var i=0;i<ENDPOINTS.length;i++){if(ENDPOINTS[i].id===epId){ep=ENDPOINTS[i];break;}}
      if(!ep)return;

      var btn=document.querySelector('.tester-send[data-ep="'+epId+'"]');
      btn.disabled=true;btn.innerHTML='Sending&#8230;';

      var url=ep.path,query={},body={};
      for(var i=0;i<ep.params.length;i++){
        var p=ep.params[i];
        var el=document.getElementById('tp-'+epId+'-'+p.name);
        if(!el)continue;
        var val=el.value.trim();
        if(val==='')continue;
        if(p.loc==='path'){url=url.replace(':'+p.name,encodeURIComponent(val));}
        else if(p.loc==='query'){query[p.name]=val;}
        else if(p.loc==='body'){
          if(val==='true')body[p.name]=true;
          else if(val==='false')body[p.name]=false;
          else body[p.name]=val;
        }
      }

      var qs=Object.keys(query).map(function(k){return k+'='+encodeURIComponent(query[k]);}).join('&');
      if(qs)url=url+'?'+qs;

      var opts={method:ep.method,headers:{}};
      if(['POST','PUT','PATCH'].indexOf(ep.method)>=0&&Object.keys(body).length>0){
        opts.headers['Content-Type']='application/json';
        opts.body=JSON.stringify(body);
      }

      var start=Date.now();
      var respEl=document.getElementById('tresp-'+epId);
      try{
        var res=await fetch(url,opts);
        var ms=Date.now()-start;
        var text=await res.text();
        var data;
        try{data=JSON.parse(text);}catch{data=text;}
        var pretty=typeof data==='string'?esc(data):esc(JSON.stringify(data,null,2));
        respEl.innerHTML=
          '<div class="resp-meta">'+
            '<span class="s-chip '+statusCls(res.status)+'">'+res.status+'</span>'+
            '<span class="resp-ms">'+ms+'ms</span>'+
          '</div>'+
          '<pre class="resp-body">'+pretty+'</pre>';
        respEl.style.display='block';
      }catch(e){
        respEl.innerHTML='<pre class="resp-body" style="color:var(--red)">Network error: '+esc(String(e))+'</pre>';
        respEl.style.display='block';
      }finally{
        btn.disabled=false;btn.innerHTML='Send &#9658;';
      }
    }

    /* ── Connection Info ────────────────────── */
    var SVC = '${serviceName}';

    function connBlock(title, url, configJson, codeId) {
      var urlRow = url
        ? '<div class="conn-url-row"><span class="conn-url-val">'+esc(url)+'</span>'+
          '<button class="btn-copy" onclick="copyText(\''+esc(url)+'\',this)">Copy URL</button></div>'
        : '';
      return '<div class="conn-block">'+
        '<div class="conn-block-title">'+esc(title)+
          '<button class="btn-copy" onclick="copyCode(\''+codeId+'\',this)">Copy JSON</button>'+
        '</div>'+
        urlRow+
        '<pre class="conn-code" id="'+codeId+'">'+esc(configJson)+'</pre>'+
      '</div>';
    }
    function copyText(text, btn) {
      navigator.clipboard.writeText(text).then(function(){
        var old=btn.textContent; btn.textContent='Copied!';
        setTimeout(function(){btn.textContent=old;},1400);
      });
    }
    function copyCode(id, btn) {
      var el=document.getElementById(id);
      if(el) copyText(el.textContent,btn);
    }

    async function loadConnInfo() {
      try {
        var r = await fetch(API+'/server-info');
        var info = await r.json();
        renderConnInfo(info);
      } catch(e) {
        document.getElementById('connBody').innerHTML='<div class="empty">Unable to load connection info.</div>';
      }
    }

    function renderConnInfo(info) {
      var badge=document.getElementById('connModeBadge');
      badge.textContent=info.transport;
      badge.style.color=info.transport==='remote'?'var(--purple)':info.transport==='http'?'var(--blue)':'var(--muted)';

      var base=window.location.origin;
      var authHtml=info.hasAuth
        ? '<span class="auth-badge auth-ok">&#128274; auth on</span>'
        : '<span class="auth-badge auth-warn">&#9888; no auth</span>';
      var html='';

      if(info.transport==='remote'){
        var sseUrl=base+'/sse';
        var mcpUrl=base+'/mcp';
        var authHeader=info.hasAuth?',"headers":{"Authorization":"Bearer YOUR_MCP_AUTH_TOKEN"}':'';
        var sseCfg='{\n  "mcpServers": {\n    "'+SVC+'": {\n      "url": "'+sseUrl+'"'+authHeader+'\n    }\n  }\n}';
        var mcpCfg='{\n  "mcpServers": {\n    "'+SVC+'": {\n      "url": "'+mcpUrl+'"'+authHeader+'\n    }\n  }\n}';
        html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'+
          '<span style="font-size:13px;color:var(--muted)">Mode: <strong style="color:var(--text)">Remote (public)</strong></span>'+
          authHtml+'</div>';
        html+='<div class="conn-grid">';
        html+=connBlock('Claude Desktop / Cursor  —  SSE (MCP 2024)', sseUrl, sseCfg, 'cc-sse');
        html+=connBlock('Claude.ai / MCP Inspector  —  Streamable HTTP (MCP 2025)', mcpUrl, mcpCfg, 'cc-mcp');
        html+='</div>';
      } else if(info.transport==='http'){
        var localUrl='http://127.0.0.1:'+info.port+'/mcp';
        var cfg='{\n  "mcpServers": {\n    "'+SVC+'": {\n      "url": "'+localUrl+'"\n    }\n  }\n}';
        html+='<div style="margin-bottom:14px"><span style="font-size:13px;color:var(--muted)">Mode: <strong style="color:var(--text)">Local HTTP (Streamable HTTP, localhost only)</strong></span></div>';
        html+='<div class="conn-grid" style="grid-template-columns:1fr">';
        html+=connBlock('Claude Desktop / Cursor / MCP Inspector', localUrl, cfg, 'cc-http');
        html+='</div>';
      } else {
        var stdioCfg='{\n  "mcpServers": {\n    "'+SVC+'": {\n      "command": "node",\n      "args": ["dist/index.js"]\n    }\n  }\n}';
        html+='<div style="margin-bottom:14px"><span style="font-size:13px;color:var(--muted)">Mode: <strong style="color:var(--text)">stdio (local process)</strong>  &mdash;  set <code style="font-family:var(--mono);background:var(--surface2);padding:1px 5px;border-radius:3px">TRANSPORT=remote</code> for remote access.</span></div>';
        html+='<div class="conn-grid" style="grid-template-columns:1fr">';
        html+=connBlock('Claude Desktop / Cursor (stdio)', null, stdioCfg, 'cc-stdio');
        html+='</div>';
      }

      document.getElementById('connBody').innerHTML=html;
    }

    /* ── Init ───────────────────────────────── */
    loadCredsStatus();
    loadConnInfo();
    renderTester();
    refresh();
    setInterval(refresh,5000);
  </script>
</body>
</html>`;
}
