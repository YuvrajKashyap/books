import { PocketShelf } from "./shelf/PocketShelf";
import { PrintEdition } from "./shelf/PrintEdition";
import { useShelfCamera } from "./shelf/useShelfCamera";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowDown,ArrowLeft,ArrowRight,BookOpen,ChevronDown,KeyRound,Search,X,LibraryBig,GalleryVerticalEnd} from 'lucide-react';
import {Dialog,type ShelfBook} from './components';
import {BoundVolume} from './shelf/BoundVolume';
import {focuses} from '../../shared/categories';
import {Hardcover} from './shelf/Hardcover';
import {bindingDepth,displayTitle,jacketFor} from './shelf/artwork';

const phoneQuery = '(max-width: 700px), (pointer: coarse) and (max-width: 950px) and (max-height: 540px)';
const frontRow=['Shoe Dog','Atomic Habits','A Brief History of Time','Meditations','Deep Work','The Daily Laws','Poor Charlie\'s Almanack'];
function shelfOrder(a:ShelfBook,b:ShelfBook){const rank=(x:ShelfBook)=>{const i=frontRow.indexOf(x.title);return i<0?100:i};return rank(a)-rank(b)||a.title.localeCompare(b.title)}
type RowProps = {
  books: ShelfBook[]; index: number; covers: boolean; turned: string | null;
  turn: (id: string | null) => void; open: (id: string) => void;
};
function BookcaseRow({books,index,covers,turned,turn,open}: RowProps) {
  return <div className="bay walnut-bay" style={{'--grain-y':-index*29+'px'} as CSSProperties}>
    <div className="bay-floor"/><div className={'gallery-volumes '+(covers?'face-out':'spine-out')}>
      {books.map(b=>{
        const revealed = !covers && b.id===turned;
        const title=displayTitle(b.title);
        return <div className={'volume-slot'+(revealed?' is-turned':'')} key={b.id}
          style={{'--slot':bindingDepth(b)+'px'} as CSSProperties}>
          <button className="volume-pick" title={title+' · '+b.author}
            aria-label={(covers||revealed?'Open details for ':'Turn to cover of ')+title+' by '+b.author}
            onKeyDown={e=>{if(e.key==='Escape')turn(null)}}
            onClick={()=>covers||revealed?open(b.id):turn(b.id)}>
            <BoundVolume book={b} showJacket={covers||revealed}/>
          </button>
          {revealed&&<button className="volume-return" aria-label={'Reshelve '+title} onClick={()=>turn(null)}>Reshelve</button>}
        </div>;
      })}
    </div><div className="shelf-lip"><span className="brass-plate">SHELF {String(index+1).padStart(2,'0')}</span></div>
  </div>;
}
export function PublicShelf(){
 const [books,setBooks]=useState<ShelfBook[]>([]),[state,setState]=useState<'loading'|'ok'|'error'>('loading'),[retry,setRetry]=useState(0),[rows,setRows]=useState(4),[width,setWidth]=useState(()=>window.innerWidth),[turned,setTurned]=useState<string|null>(null);
 const [params,setParams]=useSearchParams(),[opened,setOpened]=useState(false),[angle,setAngle]=useState(-12);
 const sentinel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const query=params.get('q')||'',focus=params.get('category')||'',id=params.get('pick'),selected=books.find(b=>b.id===id);
 useEffect(()=>{const ac=new AbortController();setState('loading');fetch('/api/shelf',{signal:ac.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setBooks((data.books as ShelfBook[]).sort(shelfOrder));setState('ok')}).catch(()=>{if(!ac.signal.aborted)setState('error')});return()=>ac.abort()},[retry]);
 const cabinet=useRef<HTMLElement>(null);
 useShelfCamera(cabinet);
 useEffect(()=>{const el=cabinet.current;if(!el)return;const ro=new ResizeObserver(()=>setWidth(el.clientWidth));ro.observe(el);return()=>ro.disconnect()},[]);
 const covers=params.get('layout')==='covers';
 const [phone,setPhone]=useState(()=>window.matchMedia(phoneQuery).matches);
 useEffect(()=>{const media=window.matchMedia(phoneQuery);const update=()=>setPhone(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const sort=params.get('sort')||'shelf';


 useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='/'&&!id&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)){e.preventDefault();search.current?.focus()}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[id]);
 const matches=useMemo(()=>{
   const needle=query.trim().toLowerCase();
   const found=books.filter(b=>(!focus||b.focus===focus)&&(displayTitle(b.title)+' '+b.author).toLowerCase().includes(needle));
   const byTitle=(a:ShelfBook,b:ShelfBook)=>displayTitle(a.title).localeCompare(displayTitle(b.title),'en',{numeric:true});
   if(sort==='title') found.sort(byTitle);
   if(sort==='author') found.sort((a,b)=>a.author.localeCompare(b.author,'en')||byTitle(a,b));
   if(sort==='short'||sort==='long') found.sort((a,b)=>{
     const x=jacketFor(a)?.pages,y=jacketFor(b)?.pages;
     if(x===undefined||y===undefined) return Number(y!==undefined)-Number(x!==undefined)||byTitle(a,b);
     return (sort==='short'?x-y:y-x)||byTitle(a,b);
   });
   return found;
 },[books,query,focus,sort]);
 // Pack by physical width, leaving clearance for exactly one pulled book.
 const bays: ShelfBook[][] = [];
 const capacity = Math.max(115,width - (covers ? 64 : 165));
 let occupied = 0;
 for (const book of phone ? [] : matches) {
   const pitch = covers ? 124 : bindingDepth(book) + 2;
   if (!bays.length || occupied + pitch > capacity) { bays.push([]); occupied = 0; }
   bays[bays.length-1].push(book); occupied += pitch;
 }
 const visibleBays=bays.slice(0,rows);
 const shown=visibleBays.reduce((sum,bay)=>sum+bay.length,0);
 useEffect(()=>{const el=sentinel.current;if(!el||shown>=matches.length)return;const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)setRows(n=>n+4)},{rootMargin:'500px'});io.observe(el);return()=>io.disconnect()},[shown,matches.length,phone]);
 function param(k:string,v:string){const p=new URLSearchParams(params);if(v)p.set(k,v);else p.delete(k);setParams(p,{replace:true});if(k!=='pick'){setRows(4);setTurned(null)}setAngle(-12);setOpened(false)}
 const current=matches.findIndex(b=>b.id===id);
 const controls = <div className="shelf-layout-controls"><div className="segmented" aria-label="Shelf layout"><button aria-pressed={!covers} onClick={()=>param('layout','')}><LibraryBig size={15}/>Spines</button><button aria-pressed={covers} onClick={()=>param('layout','covers')}><GalleryVerticalEnd size={15}/>Covers</button></div>
 <div className="public-selects"><label className="category-picker"><span className="phone-label">Category</span><select aria-label="Category" value={focus} onChange={e=>param('category',e.target.value)}><option value="">All categories</option>{focuses.map(f=><option key={f}>{f}</option>)}</select><ChevronDown size={14}/></label>
 <label className="category-picker"><span className="phone-label">Sort by</span><select aria-label="Sort books" value={sort} onChange={e=>param('sort',e.target.value==='shelf'?'':e.target.value)}><option value="shelf">Shelf order</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="short">Shortest first</option><option value="long">Longest first</option></select><ChevronDown size={14}/></label></div></div>;
 return <div className="reading-gallery"><header className="gallery-head"><div className="gallery-nav"><Link to="/" className="exlibris"><span className="monogram">YK</span><span>Yuvraj Kashyap</span></Link><div className="gallery-tools"><Link to="/admin"><KeyRound size={14}/><span>Owner sign-in</span></Link></div></div></header>
 <main className="gallery-main"><div className="gallery-title"><div><h1>My <i>bookshelf.</i></h1><p>{state==='ok'?books.length+(phone?' titles · Swipe to browse':' titles in my collection'):'The collection of Yuvraj Kashyap'}</p></div><a href="#bookcase" className="browse-cue"><ArrowDown size={16}/>Browse shelves</a></div>
 <div className="catalog-controls"><label className="catalog-search"><Search size={17}/><input ref={search} aria-label="Search books" placeholder="Find a title or author" value={query} onChange={e=>param('q',e.target.value)}/>{query?<button aria-label="Clear search" onClick={()=>param('q','')}><X size={14}/></button>:<kbd>/</kbd>}</label>
 {!phone&&controls}</div>
 <section ref={cabinet} className={phone?'pocket-section':'cabinet'} id={phone?undefined:'bookcase'} aria-label="Wooden bookshelf">
 {phone ? state==='ok'&&matches.length>0&&<PocketShelf key={JSON.stringify([query,focus,sort,covers])} books={matches} covers={covers} open={id=>param('pick',id)}/>
 : <><div className="cornice"/>{state==='ok'&&visibleBays.map((bay,i)=><BookcaseRow key={i} index={i} covers={covers} turned={turned} turn={setTurned} books={bay} open={id=>param('pick',id)}/>)}<div className="plinth"/></>}
 {state!=='ok'||!matches.length?<div className="case-message">{state==='loading'?'Opening the shelves…':state==='error'?<button onClick={()=>setRetry(n=>n+1)}>Retry loading the shelves</button>:'No matching titles.'}</div>:null}</section>
 {phone&&controls}
 {!phone&&<div ref={sentinel} className="catalog-end">{state==='ok'&&<><span>{shown} of {matches.length} titles</span>{shown<matches.length?<button onClick={()=>setRows(n=>n+4)}>Load next shelves</button>:<a href="#bookcase">Back to the first shelf ↑</a>}</>}</div>}</main>
 {selected&&<Dialog title="From my bookshelf" onClose={()=>param('pick','')}><div className="book-inspection"><div className="inspection-stage"><div className="inspection-volume" style={{'--turn':angle+'deg'} as CSSProperties}><Hardcover book={selected} opened={opened}/></div></div><div className="inspect-controls"><label>Rotate<input type="range" aria-label="Rotate book" min="-100" max="100" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><button onClick={()=>{setAngle(-7);setOpened(!opened)}}><BookOpen size={14}/>{opened?'Close cover':'Open cover'}</button></div><small>{selected.focus}</small><h2>{displayTitle(selected.title)}</h2><p>{selected.author}</p><PrintEdition book={selected}/>{jacketFor(selected)?.custom&&<small>Custom library jacket</small>}<div className="inspect-nav"><button disabled={current<=0} onClick={()=>param('pick',matches[current-1].id)}><ArrowLeft size={15}/>Previous</button><button disabled={current<0||current+1>=matches.length} onClick={()=>param('pick',matches[current+1].id)}>Next<ArrowRight size={15}/></button></div></div></Dialog>}</div>
}
