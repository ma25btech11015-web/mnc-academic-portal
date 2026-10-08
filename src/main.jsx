import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Bell, BookOpen, CalendarDays, ChevronRight, Clock3, ExternalLink, FileText, Home, MapPin, Menu, RefreshCw, Search, Sparkles, Star, X } from 'lucide-react';
import rawData from './data.json';
import './styles.css';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SLOTS = [
  { label:'09-10 AM', start:'09:00' },
  { label:'10-11 AM', start:'10:00' },
  { label:'11-12 PM', start:'11:00' },
  { label:'12-1 PM', start:'12:00' },
  { label:'2:30-4 PM', start:'14:30' },
  { label:'4-5:30 PM', start:'16:00' }
];
const palette = ['pink','blue','cyan','green','purple','gold'];

function safe(v, fallback='') { return v === undefined || v === null || v === '' ? fallback : String(v); }
function parseMinutes(t='') { const [h,m]=String(t).split(':').map(Number); return Number.isFinite(h)&&Number.isFinite(m) ? h*60+m : 0; }
function formatDate(v) { if(!v) return ''; const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function formatClock(date=new Date()) { return date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}); }
function timeUntil(date,time) {
  if(!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  const diff = d.getTime()-Date.now();
  if(diff <= 0) return 'Started / passed';
  const mins=Math.floor(diff/60000), days=Math.floor(mins/1440), hrs=Math.floor((mins%1440)/60), rem=mins%60;
  if(days) return `in ${days}d ${hrs}h`;
  if(hrs) return `in ${hrs}h ${rem}m`;
  return `in ${rem}m`;
}
function classroomDate(item) {
  if(!item?.dueDate) return '';
  const y=item.dueDate.year, m=String(item.dueDate.month).padStart(2,'0'), d=String(item.dueDate.day).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function classroomMaterialLink(material) {
  return material?.driveFile?.alternateLink || material?.youtubeVideo?.alternateLink || material?.link?.url || material?.form?.formUrl || '';
}
function classroomMaterialTitle(material) {
  return material?.driveFile?.title || material?.youtubeVideo?.title || material?.link?.title || material?.form?.title || 'Open material';
}

function usePortalData() {
  const [data,setData]=useState(rawData);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const refresh=async()=>{
    const endpoint=import.meta.env.VITE_APPS_SCRIPT_URL;
    if(!endpoint){ setData(rawData); setError(''); return; }
    setLoading(true); setError('');
    try {
      const names=['SETTINGS','TIMETABLE','COURSES','ASSESSMENTS','RESOURCES','ACADEMIC_EVENTS','REMINDER_SETTINGS','ANNOUNCEMENTS','OTHER_ANNOUNCEMENTS'];
      const entries=await Promise.all(names.map(async sheet=>{
        const r=await fetch(`${endpoint}?sheet=${encodeURIComponent(sheet)}`);
        if(!r.ok) throw new Error(`Failed to load ${sheet}`);
        const json=await r.json();
        if(json?.error) throw new Error(json.error);
        return [sheet,json];
      }));
      setData(Object.fromEntries(entries));
    } catch(e) {
      setError('Live academic data could not be loaded. Showing the bundled database snapshot.');
      setData(rawData);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ refresh(); },[]);
  return {data,loading,error,refresh};
}

const DataContext=React.createContext(null);
function App(){ const portal=usePortalData(); return <DataContext.Provider value={portal}><BrowserRouter><Layout/></BrowserRouter></DataContext.Provider>; }
function useData(){ return React.useContext(DataContext); }

function Layout(){
  const [menu,setMenu]=useState(false);
  const {loading,error,refresh}=useData();
  const links=[['/','Home',Home],['/timetable','Timetable',CalendarDays],['/courses','Courses',BookOpen],['/assessments','Assessments',FileText],['/events','Events',CalendarDays]];
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-wrap"><img src="/iith-logo.jpg" className="logo" alt="IIT Hyderabad"/><div className="brand-text"><strong>MNC 2025-2029</strong><span>Mathematics and Computing</span></div></div>
      <button className="mobile-menu" onClick={()=>setMenu(v=>!v)} aria-label="Menu">{menu?<X/>:<Menu/>}</button>
      <nav className={menu?'nav open':'nav'}>{links.map(([to,label,Icon])=><NavLink key={to} to={to} onClick={()=>setMenu(false)} className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon size={16}/>{label}</NavLink>)}<Link className="nav-link" to="/reminders" onClick={()=>setMenu(false)}><Bell size={16}/>Reminders</Link></nav>
      <button className="refresh" onClick={refresh} title="Refresh data"><RefreshCw size={17} className={loading?'spin':''}/><span>Refresh</span></button>
    </header>
    {error&&<div className="notice">{error}</div>}
    <main><Routes><Route path="/" element={<HomePage/>}/><Route path="/timetable" element={<TimetablePage/>}/><Route path="/courses" element={<CoursesPage/>}/><Route path="/courses/:courseId" element={<CoursePage/>}/><Route path="/assessments" element={<AssessmentsPage/>}/><Route path="/events" element={<EventsPage/>}/><Route path="/reminders" element={<RemindersPage/>}/><Route path="*" element={<HomePage/>}/></Routes></main>
    <footer><span>MNC 2025-2029</span><span>Indian Institute of Technology Hyderabad</span><span>Academic Portal</span></footer>
  </div>
}

function getCurrentClass(classes, now=new Date()) {
  const day=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(now);
  const minute=now.getHours()*60+now.getMinutes();
  return (classes||[]).find(c=>c.Day===day && minute>=parseMinutes(c['Start Time']) && minute<parseMinutes(c['End Time']));
}
function getNextClass(classes, now=new Date()) {
  const day=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(now);
  const minute=now.getHours()*60+now.getMinutes();
  return (classes||[]).filter(c=>c.Day===day && parseMinutes(c['Start Time'])>minute).sort((a,b)=>parseMinutes(a['Start Time'])-parseMinutes(b['Start Time']))[0] || null;
}
function CurrentClassCard(){
  const {data}=useData();
  const [now,setNow]=useState(new Date());
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return()=>clearInterval(id); },[]);
  const current=getCurrentClass(data.TIMETABLE||[],now);
  const next=getNextClass(data.TIMETABLE||[],now);
  return <div className={`now-card ${current?'live':''}`}>
    <div className="now-stars"><Star size={15}/><Sparkles size={13}/><Star size={9}/></div>
    <div className="now-label">{current?'LIVE NOW':'CURRENTLY FREE'}</div>
    {current ? <><div className="now-title">{current['Course Name']}</div><div className="now-code">{current['Course ID']}</div><div className="now-meta"><span><Clock3 size={14}/>{current['Start Time']}–{current['End Time']}</span><span><MapPin size={14}/>{current.Venue||'Venue TBA'}</span></div><Link to={`/courses/${current['Course ID']}`} className="now-link">Open course <ChevronRight size={14}/></Link></> : <><div className="now-title">No class right now</div><div className="now-code">It is {formatClock(now)}</div>{next?<div className="next-class"><span>Next on today</span><b>{next['Course Name']}</b><small>{next['Start Time']}–{next['End Time']} · {next.Venue||'Venue TBA'}</small></div>:<div className="next-class"><span>Today's classes are over</span><b>Enjoy your evening ✨</b><small>The portal will update automatically with your next class.</small></div>}</>}
  </div>
}
function Hero(){ const {data}=useData(); const s=Object.fromEntries((data.SETTINGS||[]).map(x=>[x.Key,x.Value])); return <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={13}/> Indian Institute of Technology Hyderabad</div><h1>MNC Academic Portal</h1><p>{safe(s.batch,'2025-2029')} · {safe(s.department,'Mathematics and Computing')}</p><div className="hero-meta"><span>{safe(s.active_semester,'3rd Semester')}</span><span>{safe(s.academic_year,'2026-2027')}</span></div></div><CurrentClassCard/></section> }

function HomePage(){
  const {data}=useData();
  const timetable=data.TIMETABLE||[], assessments=data.ASSESSMENTS||[], events=data.ACADEMIC_EVENTS||[];
  const announcements=(data.ANNOUNCEMENTS||[]).filter(a=>String(a.Active).toLowerCase()!=='false');
  const others=(data.OTHER_ANNOUNCEMENTS||[]).filter(a=>String(a.Active).toLowerCase()!=='false');
  const courses=data.COURSES||[];
  const upcoming=[...assessments.map(a=>({...a,_kind:'Assessment'})),...events.map(e=>({...e,_kind:'Event'}))].filter(x=>x.Date).sort((a,b)=>new Date(a.Date+'T'+safe(a['Start Time'],'00:00'))-new Date(b.Date+'T'+safe(b['Start Time'],'00:00'))).slice(0,5);
  return <div className="page"><Hero/><section className="stats"><Stat label="Courses" value={courses.length}/><Stat label="Weekly Classes" value={timetable.length}/><Stat label="Assessments" value={assessments.length}/><Stat label="Academic Events" value={events.length}/></section><div className="home-grid"><section className="panel"><div className="panel-head"><div><p className="kicker">Today & next</p><h2>Academic schedule</h2></div><Link to="/timetable">View timetable <ChevronRight size={16}/></Link></div><TodaySchedule/></section><section className="panel"><div className="panel-head"><div><p className="kicker">Upcoming</p><h2>Assessments & events</h2></div><Link to="/assessments">All assessments <ChevronRight size={16}/></Link></div>{upcoming.length?upcoming.map((x,i)=><UpcomingItem key={i} item={x}/>):<Empty text="No assessments or academic events have been added yet."/>}</section></div><div className="home-grid lower"><section className="panel"><div className="panel-head"><div><p className="kicker">Important</p><h2>Announcements</h2></div></div>{announcements.length?announcements.slice(0,4).map((a,i)=><Announcement key={i} item={a}/>):<Empty text="No announcements at the moment."/>}</section><section className="panel other"><div className="panel-head"><div><p className="kicker">CR space</p><h2>Other announcements</h2></div></div>{others.length?others.slice(0,5).map((a,i)=><Announcement key={i} item={a}/>):<Empty text="No other announcements at the moment."/>}</section></div></div>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function TodaySchedule(){ const {data}=useData(); const day=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(new Date()); const classes=(data.TIMETABLE||[]).filter(x=>x.Day===day).sort((a,b)=>parseMinutes(a['Start Time'])-parseMinutes(b['Start Time'])); return classes.length?<div className="schedule-list">{classes.map((c,i)=><Link className="schedule-row" to={`/courses/${c['Course ID']}`} key={i}><span className={`course-dot ${palette[i%palette.length]}`}></span><span className="time">{c['Start Time']}–{c['End Time']}</span><span className="course-name"><b>{c['Course Name']}</b><small>{c['Course ID']} · {c.Venue}</small></span><span className="status-pill">{c.Status||'Scheduled'}</span></Link>)}</div>:<Empty text={`No classes listed for ${day}.`}/> }
function UpcomingItem({item}){return <div className="upcoming"><div className="date-box"><b>{formatDate(item.Date).split(' ')[0]}</b><span>{formatDate(item.Date).split(' ').slice(1).join(' ')}</span></div><div><b>{safe(item['Assessment Name']||item.EventName||item['Event Name'],'Academic event')}</b><p>{safe(item['Course ID'],'General')} · {safe(item['Start Time']||'Time TBA')} {item.Venue?`· ${item.Venue}`:''}</p></div><span className="countdown">{timeUntil(item.Date,item['Start Time'])||'Scheduled'}</span></div>}
function Announcement({item}){return <div className="announcement"><div><span className={`priority ${String(item.Priority||'Normal').toLowerCase()}`}>{safe(item.Priority,'Normal')}</span><b>{item.Title}</b><p>{item.Description}</p></div>{item.Link&&<a href={item.Link} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}</div>}
function Empty({text}){return <div className="empty">{text}</div>}

function TimetablePage(){ const {data}=useData(); const navigate=useNavigate(); const classes=data.TIMETABLE||[]; return <div className="page"><PageTitle title="Weekly Timetable" subtitle="Your weekly classes, kept live from the academic database."/><div className="legend"><span><i className="dot scheduled"></i>Scheduled</span><span><i className="dot delayed"></i>Delayed</span><span><i className="dot cancelled"></i>Cancelled</span><span className="hint">Click a class for course details</span></div><div className="timetable-wrap"><div className="timetable"><div className="time-head day-head">DAY</div>{SLOTS.map(s=><div className="time-head" key={s.label}>{s.label}</div>)}{DAYS.map(day=><React.Fragment key={day}><div className="day-label">{day.slice(0,3).toUpperCase()}</div>{SLOTS.map(slot=>{const c=classes.find(x=>x.Day===day&&parseMinutes(x['Start Time'])===parseMinutes(slot.start)); const idx=(data.COURSES||[]).findIndex(x=>x['Course ID']===c?.['Course ID']); return <div className="cell" key={slot.label}>{c&&<button className={`class-card ${palette[(idx<0?0:idx)%palette.length]} ${String(c.Status||'Scheduled').toLowerCase()}`} onClick={()=>navigate(`/courses/${c['Course ID']}`)}><strong>{c['Course Name']}</strong><span>{c['Course ID']}</span><small><MapPin size={12}/>{c.Venue}</small>{c.Delay&&<em>{c.Delay} min delay</em>}</button>}</div>})}</React.Fragment>)}</div></div></div> }
function PageTitle({title,subtitle}){return <div className="page-title"><div><p className="kicker">MNC 2025-2029</p><h1>{title}</h1><p>{subtitle}</p></div></div>}

function CoursesPage(){ const {data}=useData(); const [q,setQ]=useState(''); const courses=(data.COURSES||[]).filter(c=>String(c.Active).toLowerCase()!=='false'); const filtered=courses.filter(c=>`${c['Course ID']} ${c['Course Name']} ${c.Instructor||''}`.toLowerCase().includes(q.toLowerCase())); return <div className="page"><PageTitle title="Courses" subtitle="Every course links to its assessments, resources, syllabus and schedule."/><div className="searchbar"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search course ID, name or instructor..."/></div><div className="course-grid">{filtered.map((c,i)=><Link to={`/courses/${c['Course ID']}`} className="course-card" key={c['Course ID']}><span className={`course-accent ${palette[i%palette.length]}`}></span><div className="course-top"><span>{c['Course ID']}</span><span>{c.Credits} credits</span></div><h3>{c['Course Name']}</h3><p>{c['Course Type']||'Course'} · {c['Default Venue']||'Venue TBA'}</p><span className="view-link">Open course <ChevronRight size={15}/></span></Link>)}</div></div> }

function CoursePage(){
  const {courseId}=useParams(); const {data}=useData();
  const [classroom,setClassroom]=useState(null);
  const course=(data.COURSES||[]).find(c=>c['Course ID']===courseId);
  useEffect(()=>{
    let cancelled=false;
    const endpoint=import.meta.env.VITE_APPS_SCRIPT_URL;
    if(!courseId||!endpoint){ setClassroom(null); return; }
    (async()=>{
      try {
        const r=await fetch(`${endpoint}?action=classroom&courseId=${encodeURIComponent(courseId)}`);
        if(!r.ok) throw new Error('Classroom request failed');
        const result=await r.json();
        if(!cancelled) setClassroom(result?.classroomConnected ? result : null);
      } catch { if(!cancelled) setClassroom(null); }
    })();
    return()=>{cancelled=true;};
  },[courseId]);
  if(!course) return <div className="page"><Empty text="Course not found."/></div>;
  const assessments=(data.ASSESSMENTS||[]).filter(a=>a['Course ID']===courseId);
  const resources=(data.RESOURCES||[]).filter(r=>r['Course ID']===courseId);
  const timetable=(data.TIMETABLE||[]).filter(x=>x['Course ID']===courseId);
  const events=(data.ACADEMIC_EVENTS||[]).filter(x=>x['Course ID']===courseId);
  const localAnnouncements=(data.ANNOUNCEMENTS||[]).filter(a=>!a['Course ID']||a['Course ID']===courseId).filter(a=>String(a.Active).toLowerCase()!=='false');
  const classroomAnnouncements=(classroom?.announcements||[]).filter(a=>String(a.state||'PUBLISHED').toUpperCase()==='PUBLISHED').map(a=>({Title:a.text||'Classroom announcement',Description:`Google Classroom · ${formatDate(a.creationTime)}`,Priority:'Classroom',Link:a.alternateLink}));
  const mergedAnnouncements=[...classroomAnnouncements,...localAnnouncements];
  const classroomResources=[];
  (classroom?.materials||[]).forEach((item,i)=>{
    const mats=(item.materials||[]).map(m=>({Title:classroomMaterialTitle(m),Description:`Google Classroom · ${safe(item.description,'Course material')}`,ResourceType:'Classroom material',Link:classroomMaterialLink(m)})).filter(x=>x.Link);
    if(mats.length) classroomResources.push(...mats); else if(item.alternateLink) classroomResources.push({Title:item.title||'Classroom material',Description:`Google Classroom · ${safe(item.description,'Course material')}`,ResourceType:'Classroom material',Link:item.alternateLink});
  });
  const classroomAssignments=(classroom?.coursework||[]).filter(x=>String(x.workType||'').toUpperCase()!=='QUIZ').map(x=>({Title:x.title||'Problem set',Description:`Google Classroom${x.dueDate?` · Due ${classroomDate(x)}`:''}${x.maxPoints!=null?` · ${x.maxPoints} points`:''}`,ResourceType:'Problem set',Link:x.alternateLink||'',Materials:x.materials||[]}));
  const classroomQuizzes=(classroom?.coursework||[]).filter(x=>String(x.workType||'').toUpperCase()==='QUIZ').map(x=>({
    'Assessment Type':'Classroom Quiz','Assessment Name':x.title||'Classroom quiz','Date':classroomDate(x),'Start Time':'','End Time':'','Venue':'Google Classroom','Weightage':x.maxPoints!=null?`${x.maxPoints} points`:''
  }));
  const mergedResources=[...classroomAssignments,...classroomResources,...resources.map(r=>({Title:r.Title,Description:r.Description,ResourceType:r['Resource Type'],Link:r['Google Drive URL']}))];
  const mergedAssessments=[...assessments,...classroomQuizzes];
  return <div className="page"><div className="course-hero"><div><p className="kicker">{course['Course ID']}</p><h1>{course['Course Name']}</h1><p>{course['Short Description']||'Course information will appear here as the academic database is populated.'}</p></div><div className="course-badges"><b>{course.Credits} Credits</b><span>{course['Course Type']}</span><span><MapPin size={14}/>{course['Default Venue']||'Venue TBA'}</span></div></div><div className="detail-grid"><section className="panel"><h2>Class schedule</h2>{timetable.length?<div className="mini-list">{timetable.map((c,i)=><div className="mini-row" key={i}><b>{c.Day}</b><span>{c['Start Time']}–{c['End Time']}</span><span>{c.Venue}</span><span className="status-pill">{c.Status}</span></div>)}</div>:<Empty text="No classes found."/>}</section><section className="panel"><h2>Assessments & exams</h2>{mergedAssessments.length?mergedAssessments.map((a,i)=><AssessmentRow key={i} a={a}/>):<Empty text="No assessments scheduled yet."/>}</section><section className="panel"><h2>Resources</h2>{mergedResources.length?mergedResources.map((r,i)=><MergedResourceRow key={i} r={r}/>):<Empty text="No resources uploaded yet."/>}</section><section className="panel"><h2>Announcements</h2>{mergedAnnouncements.length?mergedAnnouncements.slice(0,8).map((a,i)=><Announcement key={i} item={a}/>):<Empty text="No announcements for this course yet."/>}</section><section className="panel"><h2>Academic events</h2>{events.length?events.map((e,i)=><div className="event-row" key={i}><CalendarDays size={18}/><div><b>{e['Event Name']}</b><p>{formatDate(e.Date)} · {e['Start Time']||'Time TBA'} {e.Venue?`· ${e.Venue}`:''}</p></div></div>):<Empty text="No course-specific events yet."/>}</section></div></div>
}
function AssessmentRow({a}){return <div className="assessment-row"><div><span className="type-tag">{a['Assessment Type']}</span><b>{a['Assessment Name']}</b><p>{formatDate(a.Date)} · {a['Start Time']||'Time TBA'} · {a.Venue||'Venue TBA'}</p></div><strong>{a.Weightage||'Weightage TBA'}</strong></div>}
function MergedResourceRow({r}){ const mats=r.Materials||[]; return <div className="resource-row"><FileText size={20}/><div><b>{r.Title}</b><p>{safe(r.ResourceType,'Resource')} {r.Description?`· ${r.Description}`:''}</p>{mats.length>0&&<div className="resource-materials">{mats.map((m,i)=>{const link=classroomMaterialLink(m); return link?<a key={i} href={link} target="_blank" rel="noreferrer" className="view-link">{classroomMaterialTitle(m)} <ExternalLink size={13}/></a>:null})}</div>}</div>{r.Link&&<a href={r.Link} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}</div> }

function AssessmentsPage(){const {data}=useData(); const [filter,setFilter]=useState('All'); const rows=data.ASSESSMENTS||[]; const types=['All',...new Set(rows.map(x=>x['Assessment Type']).filter(Boolean))]; const filtered=filter==='All'?rows:rows.filter(x=>x['Assessment Type']===filter); return <div className="page"><PageTitle title="Assessments" subtitle="No fixed number of quizzes, exams or assignments. Add rows in the backend and they appear here."/><div className="chips">{types.map(t=><button className={filter===t?'chip active':'chip'} key={t} onClick={()=>setFilter(t)}>{t}</button>)}</div>{filtered.length?<div className="assessment-grid">{filtered.map((a,i)=><div className="panel assessment-card" key={i}><div className="assessment-head"><span>{a['Course ID']}</span><b>{a['Assessment Type']}</b></div><h3>{a['Assessment Name']}</h3><p><CalendarDays size={15}/>{formatDate(a.Date)}</p><p><Clock3 size={15}/>{a['Start Time']||'TBA'} {a['End Time']?`– ${a['End Time']}`:''}</p><p><MapPin size={15}/>{a.Venue||'Venue TBA'}</p>{a.Weightage&&<div className="weight">Weightage <strong>{a.Weightage}</strong></div>}</div>)}</div>:<div className="panel"><Empty text="No assessments have been entered in the database yet."/></div>}</div>}
function EventsPage(){const {data}=useData(); const rows=data.ACADEMIC_EVENTS||[]; return <div className="page"><PageTitle title="Academic Events" subtitle="Paper checking, paper viewing, meetings, extra classes, vivas and other events."/><div className="event-list">{rows.length?rows.map((e,i)=><div className="panel event-card" key={i}><div className="event-icon"><CalendarDays/></div><div className="event-main"><div><span className="type-tag">{e['Event Type']}</span><h3>{e['Event Name']}</h3></div><p>{e['Course ID']||'General MNC event'} · {formatDate(e.Date)} · {e['Start Time']||'Time TBA'} {e.Venue?`· ${e.Venue}`:''}</p><span>{e.Description||''}</span></div></div>):<div className="panel"><Empty text="No academic events have been added yet."/></div>}</div></div>}
function RemindersPage(){const {data}=useData(); const now=new Date(); const items=[...(data.ASSESSMENTS||[]).map(x=>({...x,kind:'Assessment',name:x['Assessment Name']})),...(data.ACADEMIC_EVENTS||[]).map(x=>({...x,kind:'Event',name:x['Event Name']}))].filter(x=>x.Date&&new Date(`${x.Date}T${x['Start Time']||'23:59'}`)>now).sort((a,b)=>new Date(`${a.Date}T${a['Start Time']||'23:59'}`)-new Date(`${b.Date}T${b['Start Time']||'23:59'}`)); return <div className="page"><PageTitle title="Reminders" subtitle="Upcoming assessments and academic events."/><div className="panel"><div className="reminder-banner"><Bell size={20}/><div><b>Reminder engine</b><p>Class, quiz, exam and meeting times are designed to come from the same backend rows, so changes propagate without editing the frontend.</p></div></div>{items.length?items.map((x,i)=><div className="reminder-row" key={i}><div className="reminder-time"><b>{timeUntil(x.Date,x['Start Time'])||'Upcoming'}</b><span>{formatDate(x.Date)}</span></div><div><span className="type-tag">{x.kind}</span><b>{x.name}</b><p>{x['Course ID']||'General'} · {x['Start Time']||'Time TBA'} {x.Venue?`· ${x.Venue}`:''}</p></div></div>):<Empty text="Nothing upcoming has been entered yet."/>}</div></div>}

createRoot(document.getElementById('root')).render(<App/>);
