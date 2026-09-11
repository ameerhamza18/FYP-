const API = location.origin;
let token = sessionStorage.getItem('tl_token');

async function api(path){
  const r = await fetch(API+path,{headers:{'Authorization':'Bearer '+token}});
  if(r.status===401||r.status===403){logout();throw new Error('unauthorized');}
  return r.json();
}

async function login(){
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  const err=document.getElementById('error');
  try {
    const r=await fetch(API+'/api/auth/login',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(!r.ok){err.textContent='Login failed — admin credentials required';err.style.display='block';return;}
    const data=await r.json();
    if(data.role!=='admin'){err.textContent='This console requires an admin account';err.style.display='block';return;}
    token=data.access_token; sessionStorage.setItem('tl_token',token);
    showDash();
  } catch(e) {
    err.textContent='Connection error — is the API running on port 8001?';
    err.style.display='block';
  }
}

function logout(){token=null;sessionStorage.removeItem('tl_token');
  document.getElementById('dashView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');}

function showDash(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('dashView').classList.remove('hidden');
  loadStats();loadCampaigns();
}

function badge(level){
  const cls={CRITICAL:'b-critical',HIGH:'b-high',MEDIUM:'b-medium'}[level]||'b-low';
  return '<span class="badge '+cls+'">'+level+'</span>';
}

async function loadStats(){
  const s=await api('/api/admin/stats');
  document.getElementById('statGrid').innerHTML=
    '<div class="stat"><div class="num blue">'+s.total_analyses.toLocaleString()+'</div><div class="lbl">Total Analyses</div></div>'+
    '<div class="stat"><div class="num red">'+s.high_risk.toLocaleString()+'</div><div class="lbl">High Risk</div></div>'+
    '<div class="stat"><div class="num orange">'+s.phishing.toLocaleString()+'</div><div class="lbl">Phishing</div></div>'+
    '<div class="stat"><div class="num orange">'+s.job_scams.toLocaleString()+'</div><div class="lbl">Job Scams</div></div>'+
    '<div class="stat"><div class="num orange">'+s.financial_fraud.toLocaleString()+'</div><div class="lbl">Financial Fraud</div></div>'+
    '<div class="stat"><div class="num red">'+s.active_campaigns+'</div><div class="lbl">Active Campaigns</div></div>';

  const trendBody=document.querySelector('#trendTable tbody');
  const max=Math.max(1,...s.threat_trend.map(d=>d.total));
  trendBody.innerHTML=s.threat_trend.slice().reverse().map(d=>
    '<tr><td>'+d.date+'</td><td>'+d.total+'</td><td>'+d.high+'</td>'+
    '<td style="width:40%"><div class="bar" style="width:'+(d.total/max*100).toFixed(0)+'%"></div></td></tr>').join('')
    ||'<tr><td colspan="4" style="color:var(--muted)">No data yet</td></tr>';

  document.querySelector('#techTable tbody').innerHTML=s.top_techniques.map((t,i)=>
    '<tr><td>'+(i+1)+'</td><td>'+t.technique+'</td><td>'+t.count+'</td></tr>').join('')
    ||'<tr><td colspan="3" style="color:var(--muted)">No data yet</td></tr>';
}

async function loadCampaigns(){
  const c=await api('/api/admin/campaigns');
  document.querySelector('#campTable tbody').innerHTML=c.map(x=>
    '<tr><td>'+badge(x.severity)+'</td><td>'+x.hits+'</td><td>'+x.distinct_users+'</td>'+
    '<td>'+new Date(x.first_seen).toLocaleString()+'</td>'+
    '<td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">'+
    String(x.sample_snippet||'').replace(/</g,'&lt;')+'</td></tr>').join('')
    ||'<tr><td colspan="5" style="color:var(--muted)">No campaigns detected yet</td></tr>';
}

if(token){ api('/api/admin/stats').then(showDash).catch(()=>{}); }
