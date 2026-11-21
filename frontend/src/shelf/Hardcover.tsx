import type {CSSProperties} from 'react';
import {Cover,ink,type ShelfBook} from '../components';
import {bindingDepth,displayTitle,jacketFor} from './artwork';
export function Hardcover({book,opened=false,shelf=false,priority=false}:{book:ShelfBook;opened?:boolean;shelf?:boolean;priority?:boolean}){
 return <span aria-hidden="true" className={'hardcover'+(opened?' opened':'')} style={{'--binding':jacketFor(book)?.cloth ?? ink(book),'--depth':bindingDepth(book)*1.2+'px'} as CSSProperties}>
 <span className="book-board back-board"/><span className="leaf-edge fore-edge"/><span className="leaf-edge head-edge"/><span className="leaf-edge foot-edge"/>
 <span className="book-binding">{displayTitle(book.title)}</span>
 {opened&&<span className="half-title"><strong>{displayTitle(book.title)}</strong><span>{book.author}</span></span>}
 <span className="book-board front-board"><Cover book={book} shelf={shelf} priority={priority}/></span></span>
}
