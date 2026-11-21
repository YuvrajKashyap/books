import { PocketShelf } from "./shelf/PocketShelf";
import { ScienceStudy } from "./shelf/ScienceStudy";
import { PrintEdition } from "./shelf/PrintEdition";
import { BookSynopsis } from "./shelf/BookSynopsis";
import { useShelfCamera } from "./shelf/useShelfCamera";
import {memo,useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,ChevronDown,Search,X,LibraryBig,GalleryVerticalEnd,ListFilter,Check} from 'lucide-react';
import {Dialog,FocusIcon,type ShelfBook} from './components';
import {ShelfPick} from './shelf/ShelfPick';
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
const BookcaseRow = memo(function BookcaseRow({books,index,covers,turned,turn,open}: RowProps) {
  return <div className="bay walnut-bay" style={{'--grain-y':-index*29+'px'} as CSSProperties}>
    <div className="bay-floor"/><div className={'gallery-volumes '+(covers?'face-out':'spine-out')}>
      {books.map((b, position)=>{
        const revealed = !covers && b.id===turned;
        const title=displayTitle(b.title);
        return <div className={'volume-slot'+(revealed?' is-turned':'')} key={b.id}
          style={{'--slot':bindingDepth(b)+'px'} as CSSProperties}>
          <ShelfPick book={b} faceOut={covers || revealed} exposedEnd={position === books.length - 1}
            pick={()=>covers || revealed ? open(b.id) : turn(b.id)} reshelve={()=>turn(null)}/>
          {revealed&&<button className="volume-return" aria-label={'Reshelve '+title} onClick={()=>turn(null)}>Reshelve</button>}
        </div>;
      })}
    </div><div className="shelf-lip"><span className="brass-plate">SHELF {String(index+1).padStart(2,'0')}</span></div>
  </div>;
});
export function PublicShelf(){
 const navigate=useNavigate();
 const [books,setBooks]=useState<ShelfBook[]>([]),[state,setState]=useState<'loading'|'ok'|'error'>('loading'),[retry,setRetry]=useState(0),[rows,setRows]=useState(4),[width,setWidth]=useState(()=>window.innerWidth),[turned,setTurned]=useState<string|null>(null);
 const [params,setParams]=useSearchParams(),[opened,setOpened]=useState(false),[angle,setAngle]=useState(-12);
 const sentinel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const query=params.get('q')||'',focus=params.get('category')||'',id=params.get('pick'),selected=books.find(b=>b.id===id);
 useEffect(()=>{const ac=new AbortController();setState('loading');fetch('/api/shelf',{signal:ac.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setBooks((data.books as ShelfBook[]).sort(shelfOrder));setState('ok')}).catch(()=>{if(!ac.signal.aborted)setState('error')});return()=>ac.abort()},[retry]);
 const [phone,setPhone]=useState(()=>window.matchMedia(phoneQuery).matches);
 useEffect(()=>{const media=window.matchMedia(phoneQuery);const update=()=>setPhone(media.matches);media.addEventListener('change',update);update();return()=>media.removeEventListener('change',update)},[]);
 const cabinet=useRef<HTMLElement>(null);
 useShelfCamera(cabinet, !phone);
 useEffect(()=>{
   const el=cabinet.current;
   if(!el || phone)return;
   const observer=new ResizeObserver(([entry])=>{
     const measured=entry.contentRect.width;
     if(measured>0)setWidth(measured);
   });
   observer.observe(el);
   return()=>observer.disconnect();
 },[phone]);
 const covers=params.get('layout')==='covers';
 const sort=params.get('sort')||'shelf';


 useEffect(()=>{
   const word='secret';
   let matched=0;
   const reset=()=>{matched=0;};
   function key(e:KeyboardEvent){
     const target=e.target;
     if(id || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.isComposing ||
       (target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select,[role="textbox"]')))){
       reset();
       return;
     }
     if(e.repeat)return;
     if(e.key==='/'){e.preventDefault();search.current?.focus();reset();return;}
     if(e.key==='Shift')return;
     const letter=e.key.toLowerCase();
     matched=letter===word[matched] ? matched+1 : Number(letter===word[0]);
     if(matched===word.length){reset();navigate('/admin');}
   }
   window.addEventListener('keydown',key);
   window.addEventListener('blur',reset);
   return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',reset);};
 },[id,navigate]);
 const searchResults=useMemo(()=>{
   const needle=query.trim().toLowerCase();
   return books.filter(b=>(displayTitle(b.title)+' '+b.author).toLowerCase().includes(needle));
 },[books,query]);
 const counts=useMemo(()=>{
   const byCategory=new Map<string,number>();
   for(const book of searchResults)byCategory.set(book.focus,(byCategory.get(book.focus)??0)+1);
   return byCategory;
 },[searchResults]);
 const matches=useMemo(()=>{
   const found=searchResults.filter(b=>!focus||b.focus===focus);
   const byTitle=(a:ShelfBook,b:ShelfBook)=>displayTitle(a.title).localeCompare(displayTitle(b.title),'en',{numeric:true});
   if(sort==='title') found.sort(byTitle);
   if(sort==='author') found.sort((a,b)=>a.author.localeCompare(b.author,'en')||byTitle(a,b));
   if(sort==='short'||sort==='long') found.sort((a,b)=>{
     const x=jacketFor(a)?.pages,y=jacketFor(b)?.pages;
     if(x===undefined||y===undefined) return Number(y!==undefined)-Number(x!==undefined)||byTitle(a,b);
     return (sort==='short'?x-y:y-x)||byTitle(a,b);
   });
   return found;
 },[searchResults,focus,sort]);
 // Pack by physical width, leaving clearance for exactly one pulled book.
 const bays = useMemo(() => {
   const packed: ShelfBook[][] = [];
   if (phone) return packed;
   const capacity = Math.max(115, width - (covers ? 64 : 165));
   let occupied = 0;
   for (const book of matches) {
     const pitch = covers ? 124 : bindingDepth(book) + 2;
     if (!packed.length || occupied + pitch > capacity) {
       packed.push([]);
       occupied = 0;
     }
     packed[packed.length - 1].push(book);
     occupied += pitch;
   }
   return packed;
 }, [phone, matches, width, covers]);
 const visibleBays=bays.slice(0,rows);
 const shown=visibleBays.reduce((sum,bay)=>sum+bay.length,0);
 useEffect(()=>{const el=sentinel.current;if(!el||shown>=matches.length)return;const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)setRows(n=>n+4)},{rootMargin:'500px'});io.observe(el);return()=>io.disconnect()},[shown,matches.length,phone]);
 const param=useCallback((k:string,v:string)=>{const p=new URLSearchParams(window.location.search);if(v)p.set(k,v);else p.delete(k);setParams(p,{replace:true});if(k!=='pick'){setRows(4);setTurned(null)}setAngle(-12);setOpened(false)},[setParams]);
 const openBook=useCallback((id:string)=>param('pick',id),[param]);
 const current=matches.findIndex(b=>b.id===id);
 const controls = <div className="shelf-layout-controls">
   <div className="segmented" aria-label="Shelf layout">
     <button aria-pressed={!covers} onClick={()=>param('layout','')}><LibraryBig size={15}/>Spines</button>
     <button aria-pressed={covers} onClick={()=>param('layout','covers')}><GalleryVerticalEnd size={15}/>Covers</button>
   </div>
   <div className="public-selects">
     {!phone && <label className="category-picker"><select aria-label="Category" value={focus} onChange={e=>param('category',e.target.value)}>
       <option value="">All categories</option>{focuses.map(f=><option key={f} value={f}>{f}</option>)}</select><ChevronDown size={14}/></label>}
     <label className="category-picker"><span className="phone-label">Sort by</span>
       <select aria-label="Sort books" value={sort} onChange={e=>param('sort',e.target.value==='shelf'?'':e.target.value)}>
         <option value="shelf">Shelf order</option><option value="title">Title A–Z</option>
         <option value="author">Author A–Z</option><option value="short">Shortest first</option>
         <option value="long">Longest first</option>
       </select><ChevronDown size={14}/>
     </label>
   </div>
 </div>;
 const subjectIndex = <section className="subject-index" id="subject-index" aria-labelledby="index-title">
   <div className="index-heading">
     <h2 id="index-title" tabIndex={-1}>Subject index</h2>
     <button aria-pressed={!focus} onClick={()=>param('category','')}>All subjects <span>{searchResults.length}</span></button>
   </div>
   <div className="index-entries">{focuses.map(f=><button key={f} aria-pressed={focus===f}
     onClick={()=>param('category',focus===f?'':f)}>
     <FocusIcon focus={f}/><span>{f}</span><small>{counts.get(f)??0}</small>
     {focus===f&&<Check size={12} aria-hidden="true"/>}
   </button>)}</div>
 </section>;
 return <div className="reading-gallery">
 <header className="library-heading public-heading">
   <div className="library-heading-inner">
     <div className="catalogue-identity"><Link to="/" className="bookplate-name" aria-label="Yuvraj Kashyap’s bookshelf">Yuvraj Kashyap</Link>
       <div className="catalogue-title"><h1><i>The</i> Bookshelf</h1>
       {state==='ok' && <span className="volume-count">{books.length} volumes</span>}
       </div>
     </div>
     <ScienceStudy/>
   </div>
 </header>
 <main className="gallery-main">
 <div className="catalog-controls"><div className="search-station" role="search">
   <label className="catalog-search"><Search size={18}/><input ref={search} aria-label="Search books" placeholder="Find a title or author" value={query} onChange={e=>param('q',e.target.value)}/></label>
   {query && <button className="clear-query" aria-label="Clear search" onClick={()=>{param('q','');search.current?.focus();}}><X size={15}/></button>}
   {query||focus ? <output aria-live="polite">{matches.length} {matches.length===1?'match':'matches'}</output> : <kbd>/</kbd>}
   {phone && <button className="jump-index" aria-label="Browse categories" onClick={()=>document.getElementById('index-title')?.focus()}><ListFilter size={18}/></button>}
 </div>
 {!phone&&controls}</div>
 <section ref={cabinet} className={phone?'pocket-section':'cabinet'} id={phone?undefined:'bookcase'} aria-label="Wooden bookshelf">
 {phone ? state==='ok'&&matches.length>0&&<PocketShelf key={JSON.stringify([query,focus,sort,covers])} books={matches} covers={covers} open={openBook}/>
 : <><div className="cornice"/>{state==='ok'&&visibleBays.map((bay,i)=><BookcaseRow key={i} index={i} covers={covers} turned={turned && bay.some(b=>b.id===turned) ? turned : null} turn={setTurned} books={bay} open={openBook}/>)}<div className="plinth"/></>}
 {state!=='ok'||!matches.length?<div className="case-message">{state==='loading'?'Opening the shelves…':state==='error'?<button onClick={()=>setRetry(n=>n+1)}>Retry loading the shelves</button>:'No matching titles.'}</div>:null}</section>
 {phone&&controls}
 {phone&&subjectIndex}
 {phone&&<footer className="owner-footnote">Are you Yuvraj? <Link to="/admin">Sign in <ArrowRight size={12}/></Link></footer>}
 {!phone&&<div ref={sentinel} className="catalog-end">{state==='ok'&&<><span>{shown} of {matches.length} titles</span>{shown<matches.length?<button onClick={()=>setRows(n=>n+4)}>Load next shelves</button>:<a href="#bookcase">Back to the first shelf ↑</a>}</>}</div>}
 {!phone&&state==='ok'&&subjectIndex}</main>
 {selected && <Dialog title={displayTitle(selected.title)} onClose={() => param('pick','')}>
   <div className="book-inspection">
     <div className="inspection-stage"><div className="inspection-volume" style={{'--turn':angle+'deg'} as CSSProperties}><Hardcover book={selected} opened={opened}/></div></div>
     <div className="inspect-controls">
       <label>Rotate<input type="range" aria-label="Rotate book" min="-100" max="100" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
       <button onClick={()=>{setAngle(-7);setOpened(!opened)}}><BookOpen size={14}/>{opened?'Close cover':'Open cover'}</button>
     </div>
     <p className="inspection-byline">{selected.author}</p>
     <BookSynopsis key={selected.id} id={selected.id}/>
     <div className="inspection-imprint"><small>{selected.focus}</small><PrintEdition book={selected}/>{jacketFor(selected)?.custom&&<small>Custom library jacket</small>}</div>
     <div className="inspect-nav">
       <button disabled={current<=0} onClick={()=>param('pick',matches[current-1].id)}><ArrowLeft size={15}/>Previous</button>
       <button disabled={current<0||current+1>=matches.length} onClick={()=>param('pick',matches[current+1].id)}>Next<ArrowRight size={15}/></button>
     </div>
   </div>
 </Dialog>}</div>
}
