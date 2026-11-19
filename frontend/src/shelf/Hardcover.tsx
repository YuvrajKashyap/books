import type {CSSProperties} from 'react';
import {Cover,ink,type ShelfBook} from '../components';
import {displayTitle} from './artwork';
export function Hardcover({book,opened=false}:{book:ShelfBook;opened?:boolean}){
 return <span aria-hidden="true" className={'hardcover'+(opened?' opened':'')} style={{'--binding':ink(book)} as CSSProperties}>
 <span className="book-board back-board"/><span className="leaf-edge fore-edge"/><span className="leaf-edge head-edge"/><span className="leaf-edge foot-edge"/>
 <span className="book-binding">{displayTitle(book.title)}</span>
 {opened&&<span className="half-title"><i>Ex libris</i><strong>{displayTitle(book.title)}</strong><span>{book.author}</span></span>}
 <span className="book-board front-board"><Cover book={book}/></span></span>
}
