import {Palette} from 'lucide-react';
import {useState} from 'react';
const finishes=['Walnut','Oak','Ebony'] as const;
export function ThemePicker(){
 const [theme,setTheme]=useState(()=>document.documentElement.dataset.finish||'Walnut');
 return <label className="finish-control"><Palette size={15}/><select aria-label="Site theme and shelf finish" value={theme} onChange={e=>{const v=e.target.value;document.documentElement.dataset.finish=v;setTheme(v);try{localStorage.setItem('books-finish',v)}catch{/* Storage can be disabled. */}}}>{finishes.map(v=><option key={v}>{v}</option>)}</select></label>
}
