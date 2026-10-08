import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Bell, BookOpen, CalendarDays, ChevronRight, Clock3, ExternalLink, FileText, Home, MapPin, Menu, RefreshCw, Search, X } from 'lucide-react';
import rawData from './data.json';
import './styles.css';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SLOTS = [
  { label:'09-10 AM', start:'09:00', end:'10:00' },
  { label:'10-11 AM', start:'10:00', end:'11:00' },
  { label:'11-12 PM', start:'11:00', end:'12:00' },
  { label:'12-1 PM', start:'12:00', end:'13:00' },
  { label:'2:30-4 PM', start:'14:30', end:'16:00' },
  { label:'4-5:30 PM', start:'16:00', end:'17:30' }
];
const palette = ['pink','blue','cyan','green','purple','yellow'];

function safe(v, fallback='') { return v === undefined || v === null || v === '' ? fallback : String(v); }
function parseMinutes(t='') { const [h,m]=String(t).split(':').map(Number); return Number.isFinite(h)&&Number.isFinite(m) ? h*60+m : 0; }
function formatDate(v) { if(!v) return ''; const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function timeUntil(date, time) {
  if(!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  const diff = d.getTime()-Date.now();
  if(diff <= 0) return 'Started / passed';
  const mins = Math.floor(diff/60000), days=Math.floor(mins/1440), hrs=Math.floor((mins%1440)/60), rem=mins%60;
  if(days) return `in ${days}d ${hrs}h`;
  if(hrs) return `in ${hrs}h ${rem}m`;
  return `in ${rem}m`;
}

function usePortalData() {
  const [data,setData] = useState(rawData);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const refresh = async () => {
    const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL;
    if(!endpoint) { setData(rawData); setError(''); return; }
    setLoading(true); setError('');
    try {
      const names = ['SETTINGS','TIMETABLE','COURSES','ASSESSMENTS','RESOURCES','ACADEMIC_EVENTS','REMINDER_SETTINGS','ANNOUNCEMENTS','OTHER_ANNOUNCEMENTS'];
      const entries = await Promise.all(names.map(async sheet => {
        const r = await fetch(`${endpoint}?sheet=${encodeURIComponent(sheet)}`);
        if(!r.ok) throw new Error(`Failed to load ${sheet}`);
        return [sheet, await r.json()];
      }));
      setData(Object.fromEntries(entries));
    } catch(e) {
      setError('Live Google Sheets data could not be loaded. Showing the bundled database snapshot.');
      setData(rawData);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ refresh(); },[]);
  return {data,loading,error,refresh};
}

const DataContext = React.createContext(null);
function App() {
  const portal = usePortalData();
  return <DataContext.Provider value={portal}><BrowserRouter><Layout/></BrowserRouter></DataContext.Provider>;
}
function useData(){ return React.useContext(DataContext); }

function Layout(){
  const [menu,setMenu]=useState(false);
  const {loading,error,refresh}=useData();
  const links=[['/','Home',Home],['/timetable','Timetable',CalendarDays],['/courses','Courses',BookOpen],['/assessments','Assessments',FileText],['/events','Events',CalendarDays]];
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-wrap">
        <img src="/iith-logo.jpg" className="logo" alt="IIT Hyderabad"/>
        <div className="brand-text"><strong>MNC 2025-2029</strong><span>Mathematics and Computing</span></div>
      </div>
      <button className="mobile-menu" onClick={()=>setMenu(v=>!v)} aria-label="Menu">{menu?<X/>:<Menu/>}</button>
      <nav className={menu?'nav open':'nav'}>
        {links.map(([to,label,Icon])=><NavLink key={to} to={to} onClick={()=>setMenu(false)} className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon size={16}/>{label}</NavLink>)}
        <Link className="nav-link" to="/reminders" onClick={()=>setMenu(false)}><Bell size={16}/>Reminders</Link>
      </nav>
      <button className="refresh" onClick={refresh} title="Refresh data"><RefreshCw size={17} className={loading?'spin':''}/><span>Refresh</span></button>
    </header>
    {error && <div className="notice">{error}</div>}
    <main><Routes>
      <Route path="/" element={<HomePage/>}/><Route path="/timetable" element={<TimetablePage/>}/>
      <Route path="/courses" element={<CoursesPage/>}/><Route path="/courses/:courseId" element={<CoursePage/>}/>
      <Route path="/assessments" element={<AssessmentsPage/>}/><Route path="/events" element={<EventsPage/>}/><Route path="/reminders" element={<RemindersPage/>}/>
      <Route path="*" element={<HomePage/>}/>
    </Routes></main>
    <footer><span>MNC 2025-2029</span><span>Indian Institute of Technology Hyderabad</span><span>Academic Portal</span></footer>
  </div>
}

function Hero(){ const {data}=useData(); const s=Object.fromEntries((data.SETTINGS||[]).map(x=>[x.Key,x.Value])); return <section className="hero">
  <div><div className="eyebrow">{safe(s.institute,'Indian Institute of Technology Hyderabad')}</div><h1>MNC Academic Portal</h1><p>{safe(s.batch,'2025-2029')} · {safe(s.department,'Mathematics and Computing')}</p><div className="hero-meta"><span>{safe(s.active_semester,'3rd Semester')}</span><span>{safe(s.academic_year,'2026-2027')}</span></div></div>
  <img src="/iith-logo.jpg" alt="IIT Hyderabad logo"/>
</section> }

function HomePage(){
  const {data}=useData();
  const timetable=data.TIMETABLE||[], assessments=data.ASSESSMENTS||[], events=data.ACADEMIC_EVENTS||[], announcements=(data.ANNOUNCEMENTS||[]).filter(a=>String(a.Active).toLowerCase()!=='false'), others=(data.OTHER_ANNOUNCEMENTS||[]).filter(a=>String(a.Active).toLowerCase()!=='false');
  const courses=data.COURSES||[];
  const upcoming=[...assessments.map(a=>({...a,_kind:'Assessment'})),...events.map(e=>({...e,_kind:'Event'}))].filter(x=>x.Date).sort((a,b)=>new Date(a.Date+'T'+safe(a['Start Time']||a['Start Time'],'00:00'))-new Date(b.Date+'T'+safe(b['Start Time']||'00:00'))).slice(0,5);
  return <div className="page"><Hero/><section className="stats"><Stat label="Courses" value={courses.length}/><Stat label="Weekly Classes" value={timetable.length}/><Stat label="Assessments" value={assessments.length}/><Stat label="Academic Events" value={events.length}/></section>
    <div className="home-grid"><section className="panel"><div className="panel-head"><div><p className="kicker">Today & next</p><h2>Academic schedule</h2></div><Link to="/timetable">View timetable <ChevronRight size={16}/></Link></div><TodaySchedule/></section>
    <section className="panel"><div className="panel-head"><div><p className="kicker">Upcoming</p><h2>Assessments & events</h2></div><Link to="/assessments">All assessments <ChevronRight size={16}/></Link></div>{upcoming.length?upcoming.map((x,i)=><UpcomingItem key={i} item={x}/>):<Empty text="No assessments or academic events have been added yet."/>}</section></div>
    <div className="home-grid lower"><section className="panel"><div className="panel-head"><div><p className="kicker">Important</p><h2>Announcements</h2></div></div>{announcements.length?announcements.slice(0,4).map((a,i)=><Announcement key={i} item={a}/>):<Empty text="No announcements at the moment."/>}</section>
    <section className="panel other"><div className="panel-head"><div><p className="kicker">CR space</p><h2>Other announcements</h2></div></div>{others.length?others.slice(0,5).map((a,i)=><Announcement key={i} item={a}/>):<Empty text="No other announcements at the moment."/>}</section></div>
  </div>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function TodaySchedule(){ const {data}=useData(); const day=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(new Date()); const classes=(data.TIMETABLE||[]).filter(x=>x.Day===day).sort((a,b)=>parseMinutes(a['Start Time'])-parseMinutes(b['Start Time'])); return classes.length?<div className="schedule-list">{classes.map((c,i)=><Link className="schedule-row" to={`/courses/${c['Course ID']}`} key={i}><span className={`course-dot ${palette[i%palette.length]}`}></span><span className="time">{c['Start Time']}–{c['End Time']}</span><span className="course-name"><b>{c['Course Name']}</b><small>{c['Course ID']} · {c.Venue}</small></span><span className="status-pill">{c.Status||'Scheduled'}</span></Link>)}</div>:<Empty text={`No classes listed for ${day}.`}/> }
function UpcomingItem({item}){return <div className="upcoming"><div className="date-box"><b>{formatDate(item.Date).split(' ')[0]}</b><span>{formatDate(item.Date).split(' ').slice(1).join(' ')}</span></div><div><b>{safe(item['Assessment Name']||item.EventName||item['Event Name'],'Academic event')}</b><p>{safe(item['Course ID'],'General')} · {safe(item['Start Time']||'Time TBA')} {item.Venue?`· ${item.Venue}`:''}</p></div><span className="countdown">{timeUntil(item.Date,item['Start Time'])||'Scheduled'}</span></div>}
function Announcement({item}){return <div className="announcement"><div><span className={`priority ${String(item.Priority||'Normal').toLowerCase()}`}>{safe(item.Priority,'Normal')}</span><b>{item.Title}</b><p>{item.Description}</p></div>{item.Link&&<a href={item.Link} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}</div>}
function Empty({text}){return <div className="empty">{text}</div>}

function TimetablePage(){
 const {data}=useData(); const navigate=useNavigate(); const classes=data.TIMETABLE||[]; const courseMap=Object.fromEntries((data.COURSES||[]).map(c=>[c['Course ID'],c]));
 return <div className="page"><PageTitle title="Weekly Timetable" subtitle="Live-ready timetable layout based on your supplied class schedule."/><div className="legend"><span><i className="dot scheduled"></i>Scheduled</span><span><i className="dot delayed"></i>Delayed</span><span><i className="dot cancelled"></i>Cancelled</span><span className="hint">Click a class for course details</span></div><div className="timetable-wrap"><div className="timetable"><div className="time-head day-head">DAY</div>{SLOTS.map(s=><div className="time-head" key={s.label}>{s.label}</div>)}{DAYS.map(day=><React.Fragment key={day}><div className="day-label">{day.slice(0,3).toUpperCase()}</div>{SLOTS.map(slot=>{const c=classes.find(x=>x.Day===day&&parseMinutes(x['Start Time'])===parseMinutes(slot.start)); const idx=(data.COURSES||[]).findIndex(x=>x['Course ID']===c?.['Course ID']); return <div className="cell" key={slot.label}>{c&&<button className={`class-card ${palette[(idx<0?0:idx)%palette.length]} ${String(c.Status||'Scheduled').toLowerCase()}`} onClick={()=>navigate(`/courses/${c['Course ID']}`)}><strong>{c['Course Name']}</strong><span>{c['Course ID']}</span><small><MapPin size={12}/>{c.Venue}</small>{c.Delay&&<em>{c.Delay} min delay</em>}</button>}</div>})}</React.Fragment>)}</div></div></div>
}
function PageTitle({title,subtitle}){return <div className="page-title"><div><p className="kicker">MNC 2025-2029</p><h1>{title}</h1><p>{subtitle}</p></div></div>}

function CoursesPage(){const {data}=useData(); const [q,setQ]=useState(''); const courses=(data.COURSES||[]).filter(c=>String(c.Active).toLowerCase()!=='false'); const filtered=courses.filter(c=>`${c['Course ID']} ${c['Course Name']} ${c.Instructor||''}`.toLowerCase().includes(q.toLowerCase())); return <div className="page"><PageTitle title="Courses" subtitle="Every course links to its assessments, resources, syllabus and schedule."/><div className="searchbar"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search course ID, name or instructor..."/></div><div className="course-grid">{filtered.map((c,i)=><Link to={`/courses/${c['Course ID']}`} className="course-card" key={c['Course ID']}><span className={`course-accent ${palette[i%palette.length]}`}></span><div className="course-top"><span>{c['Course ID']}</span><span>{c.Credits} credits</span></div><h3>{c['Course Name']}</h3><p>{c['Course Type']||'Course'} · {c['Default Venue']||'Venue TBA'}</p><span className="view-link">Open course <ChevronRight size={15}/></span></Link>)}</div></div>}

function CoursePage(){const {courseId}=useParams(); const {data}=useData(); const course=(data.COURSES||[]).find(c=>c['Course ID']===courseId); if(!course) return <div className="page"><Empty text="Course not found."/></div>; const assessments=(data.ASSESSMENTS||[]).filter(a=>a['Course ID']===courseId); const resources=(data.RESOURCES||[]).filter(r=>r['Course ID']===courseId); const timetable=(data.TIMETABLE||[]).filter(x=>x['Course ID']===courseId); const events=(data.ACADEMIC_EVENTS||[]).filter(x=>x['Course ID']===courseId); return <div className="page"><div className="course-hero"><div><p className="kicker">{course['Course ID']}</p><h1>{course['Course Name']}</h1><p>{course['Short Description']||'Course information will appear here as the academic database is populated.'}</p></div><div className="course-badges"><b>{course.Credits} Credits</b><span>{course['Course Type']}</span><span><MapPin size={14}/>{course['Default Venue']||'Venue TBA'}</span></div></div><div className="detail-grid"><section className="panel"><h2>Class schedule</h2>{timetable.length?<div className="mini-list">{timetable.map((c,i)=><div className="mini-row" key={i}><b>{c.Day}</b><span>{c['Start Time']}–{c['End Time']}</span><span>{c.Venue}</span><span className="status-pill">{c.Status}</span></div>)}</div>:<Empty text="No classes found."/>}</section><section className="panel"><h2>Assessments & exams</h2>{assessments.length?assessments.map((a,i)=><AssessmentRow key={i} a={a}/>):<Empty text="No assessments scheduled yet."/>}</section><section className="panel"><h2>Resources</h2>{resources.length?resources.map((r,i)=><ResourceRow key={i} r={r}/>):<Empty text="No resources uploaded yet."/>}</section><section className="panel"><h2>Academic events</h2>{events.length?events.map((e,i)=><div className="event-row" key={i}><CalendarDays size={18}/><div><b>{e['Event Name']}</b><p>{formatDate(e.Date)} · {e['Start Time']||'Time TBA'} {e.Venue?`· ${e.Venue}`:''}</p></div></div>):<Empty text="No course-specific events yet."/>}</section></div></div>}
function AssessmentRow({a}){return <div className="assessment-row"><div><span className="type-tag">{a['Assessment Type']}</span><b>{a['Assessment Name']}</b><p>{formatDate(a.Date)} · {a['Start Time']||'Time TBA'} · {a.Venue||'Venue TBA'}</p></div><strong>{a.Weightage||'Weightage TBA'}</strong></div>}
function ResourceRow({r}){return <a className="resource-row" href={r['Google Drive URL']||'#'} target="_blank" rel="noreferrer"><FileText size={20}/><div><b>{r.Title}</b><p>{r['Resource Type']} {r.Description?`· ${r.Description}`:''}</p></div><ExternalLink size={16}/></a>}

function AssessmentsPage(){const {data}=useData(); const [filter,setFilter]=useState('All'); const rows=data.ASSESSMENTS||[]; const types=['All',...new Set(rows.map(x=>x['Assessment Type']).filter(Boolean))]; const filtered=filter==='All'?rows:rows.filter(x=>x['Assessment Type']===filter); return <div className="page"><PageTitle title="Assessments" subtitle="No fixed number of quizzes, exams or assignments. Add rows in the backend and they appear here."/><div className="chips">{types.map(t=><button className={filter===t?'chip active':'chip'} key={t} onClick={()=>setFilter(t)}>{t}</button>)}</div>{filtered.length?<div className="assessment-grid">{filtered.map((a,i)=><div className="panel assessment-card" key={i}><div className="assessment-head"><span>{a['Course ID']}</span><b>{a['Assessment Type']}</b></div><h3>{a['Assessment Name']}</h3><p><CalendarDays size={15}/>{formatDate(a.Date)}</p><p><Clock3 size={15}/>{a['Start Time']||'TBA'} {a['End Time']?`– ${a['End Time']}`:''}</p><p><MapPin size={15}/>{a.Venue||'Venue TBA'}</p>{a.Weightage&&<div className="weight">Weightage <strong>{a.Weightage}</strong></div>}</div>)}</div>:<div className="panel"><Empty text="No assessments have been entered in the database yet."/></div>}</div>}

function EventsPage(){const {data}=useData(); const rows=data.ACADEMIC_EVENTS||[]; return <div className="page"><PageTitle title="Academic Events" subtitle="Paper checking, paper viewing, meetings, extra classes, vivas and other events."/><div className="event-list">{rows.length?rows.map((e,i)=><div className="panel event-card" key={i}><div className="event-icon"><CalendarDays/></div><div className="event-main"><div><span className="type-tag">{e['Event Type']}</span><h3>{e['Event Name']}</h3></div><p>{e['Course ID']||'General MNC event'} · {formatDate(e.Date)} · {e['Start Time']||'Time TBA'} {e.Venue?`· ${e.Venue}`:''}</p><span>{e.Description||''}</span></div></div>):<div className="panel"><Empty text="No academic events have been added yet."/></div>}</div></div>}

function RemindersPage(){const {data}=useData(); const now=new Date(); const items=[...(data.ASSESSMENTS||[]).map(x=>({...x,kind:'Assessment',name:x['Assessment Name']})),...(data.ACADEMIC_EVENTS||[]).map(x=>({...x,kind:'Event',name:x['Event Name']}))].filter(x=>x.Date&&new Date(`${x.Date}T${x['Start Time']||'23:59'}`)>now).sort((a,b)=>new Date(`${a.Date}T${a['Start Time']||'23:59'}`)-new Date(`${b.Date}T${b['Start Time']||'23:59'}`)); return <div className="page"><PageTitle title="Reminders" subtitle="Upcoming assessments and academic events. Browser notifications can be enabled in a later push-notification layer."/><div className="panel"><div className="reminder-banner"><Bell size={20}/><div><b>Reminder engine</b><p>Class, quiz, exam and meeting times are designed to come from the same backend rows, so changes propagate without editing the frontend.</p></div></div>{items.length?items.map((x,i)=><div className="reminder-row" key={i}><div className="reminder-time"><b>{timeUntil(x.Date,x['Start Time'])||'Upcoming'}</b><span>{formatDate(x.Date)}</span></div><div><span className="type-tag">{x.kind}</span><b>{x.name}</b><p>{x['Course ID']||'General'} · {x['Start Time']||'Time TBA'} {x.Venue?`· ${x.Venue}`:''}</p></div></div>):<Empty text="Nothing upcoming has been entered yet."/>}</div></div>}

createRoot(document.getElementById('root')).render(<App/>);
