import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowDown,ArrowLeft,ArrowRight,BookOpen,ChevronDown,KeyRound,Search,X} from 'lucide-react';
import {Dialog,type ShelfBook} from './components';
import {ThemePicker} from './ThemePicker';
import {focuses} from '../../shared/model';
import {Hardcover} from './shelf/Hardcover';
import {displayTitle,jacketFor} from './shelf/artwork';

const frontRow=['Shoe Dog','Atomic Habits','A Brief History of Time','Meditations','Deep Work','The Daily Laws','Poor Charlie\'s Almanack'];
function shelfOrder(a:ShelfBook,b:ShelfBook){const rank=(x:ShelfBook)=>{const i=frontRow.indexOf(x.title);return i<0?100:i};return rank(a)-rank(b)||a.title.localeCompare(b.title)}
function BookcaseRow({books,index,columns,open}:{books:ShelfBook[],index:number,columns:number,open:(id:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(([entry])=>{el.classList.toggle('in-room',entry.isIntersecting)},{rootMargin:'32px'});io.observe(el);return()=>io.disconnect()},[]);
 return <div className="bay" ref={ref} style={{'--columns':columns,'--grain-y':(index*117)%600+'px'} as CSSProperties}>
 <div className="bay-floor"/><div className="row-books">{books.map((b,i)=><button key={b.id} className="volume" aria-label={'Pick up '+displayTitle(b.title)+' by '+b.author} onClick={()=>open(b.id)} style={{'--lean':[-4,2,-2,3,-3,1][i%6]+'deg','--delay':i*35+'ms','--height':(.92+((i+index)%3)*.04)} as CSSProperties}
 onPointerMove={e=>{if(e.pointerType!=='mouse')return;const el=e.currentTarget,r=el.getBoundingClientRect();el.style.setProperty('--yaw',((e.clientX-r.left)/r.width*14-7)+'deg')}} onPointerLeave={e=>e.currentTarget.style.removeProperty('--yaw')}>
 <span className="volume-shadow"/><span className="volume-lift"><Hardcover book={b}/></span><span className="volume-caption">{displayTitle(b.title)}</span></button>)}</div>
 <div className="shelf-lip"><span className="brass-plate">SHELF {String(index+1).padStart(2,'0')}</span></div></div>
}
export function PublicShelf(){
 const [books,setBooks]=useState<ShelfBook[]>([]),[state,setState]=useState<'loading'|'ok'|'error'>('loading'),[retry,setRetry]=useState(0),[rows,setRows]=useState(4),[cols,setCols]=useState(()=>window.innerWidth<580?3:window.innerWidth<900?4:6);
 const [params,setParams]=useSearchParams(),[opened,setOpened]=useState(false),[angle,setAngle]=useState(-12);
 const sentinel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const query=params.get('q')||'',focus=params.get('category')||'',id=params.get('pick'),selected=books.find(b=>b.id===id);
 useEffect(()=>{const ac=new AbortController();setState('loading');fetch('/api/shelf',{signal:ac.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setBooks((data.books as ShelfBook[]).sort(shelfOrder));setState('ok')}).catch(()=>{if(!ac.signal.aborted)setState('error')});return()=>ac.abort()},[retry]);
 useEffect(()=>{const resize=()=>setCols(window.innerWidth<580?3:window.innerWidth<900?4:6);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[]);
 useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='/'&&!id&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)){e.preventDefault();search.current?.focus()}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[id]);
 const matches=books.filter(b=>(!focus||b.focus===focus)&&(displayTitle(b.title)+' '+b.author).toLowerCase().includes(query.trim().toLowerCase()));
 const shown=Math.min(matches.length,cols*rows);
 useEffect(()=>{const el=sentinel.current;if(!el||shown>=matches.length)return;const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)setRows(n=>n+4)},{rootMargin:'500px'});io.observe(el);return()=>io.disconnect()},[shown,matches.length]);
 function param(k:string,v:string){const p=new URLSearchParams(params);if(v)p.set(k,v);else p.delete(k);setParams(p,{replace:true});if(k!=='pick')setRows(4);setAngle(-12);setOpened(false)}
 const current=matches.findIndex(b=>b.id===id);
 return <div className="reading-gallery"><header className="gallery-head"><div className="gallery-nav"><Link to="/" className="exlibris"><span className="monogram">YK</span><span>Yuvraj Kashyap</span></Link><div className="gallery-tools"><ThemePicker/><Link to="/admin"><KeyRound size={14}/><span>Owner sign-in</span></Link></div></div></header>
 <main className="gallery-main"><div className="gallery-title"><div><h1>My <i>bookshelf.</i></h1><p>{state==='ok'?books.length+' titles in my collection':'The collection of Yuvraj Kashyap'}</p></div><a href="#bookcase" className="browse-cue"><ArrowDown size={16}/>Browse shelves</a></div>
 <div className="catalog-controls"><label className="catalog-search"><Search size={17}/><input ref={search} aria-label="Search books" placeholder="Find a title or author" value={query} onChange={e=>param('q',e.target.value)}/>{query?<button aria-label="Clear search" onClick={()=>param('q','')}><X size={14}/></button>:<kbd>/</kbd>}</label>
 <label className="category-picker"><select aria-label="Category" value={focus} onChange={e=>param('category',e.target.value)}><option value="">All categories</option>{focuses.map(f=><option key={f}>{f}</option>)}</select><ChevronDown size={14}/></label></div>
 <section className="cabinet" id="bookcase" aria-label="Wooden bookshelf"><div className="cornice"/>{state==='ok'&&Array.from({length:Math.ceil(shown/cols)},(_,i)=><BookcaseRow key={i} index={i} columns={cols} books={matches.slice(i*cols,(i+1)*cols)} open={id=>param('pick',id)}/>)}
 {state!=='ok'||!matches.length?<div className="case-message">{state==='loading'?'Opening the shelves…':state==='error'?<button onClick={()=>setRetry(n=>n+1)}>Retry loading the shelves</button>:'No matching titles.'}</div>:null}<div className="plinth"/></section>
 <div ref={sentinel} className="catalog-end">{state==='ok'&&<><span>{shown} of {matches.length} titles</span>{shown<matches.length?<button onClick={()=>setRows(n=>n+4)}>Load next shelves</button>:<a href="#bookcase">Back to the first shelf ↑</a>}</>}</div></main>
 {selected&&<Dialog title="From my bookshelf" onClose={()=>param('pick','')}><div className="book-inspection"><div className="inspection-stage"><div className="inspection-volume" style={{'--turn':angle+'deg'} as CSSProperties}><Hardcover book={selected} opened={opened}/></div></div><div className="inspect-controls"><label>Rotate<input type="range" aria-label="Rotate book" min="-100" max="100" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><button onClick={()=>{setAngle(-7);setOpened(!opened)}}><BookOpen size={14}/>{opened?'Close cover':'Open cover'}</button></div><small>{selected.focus}</small><h2>{displayTitle(selected.title)}</h2><p>{selected.author}</p>{jacketFor(selected)?.custom&&<small>Custom library jacket</small>}<div className="inspect-nav"><button disabled={current<=0} onClick={()=>param('pick',matches[current-1].id)}><ArrowLeft size={15}/>Previous</button><button disabled={current<0||current+1>=matches.length} onClick={()=>param('pick',matches[current+1].id)}>Next<ArrowRight size={15}/></button></div></div></Dialog>}</div>
}
