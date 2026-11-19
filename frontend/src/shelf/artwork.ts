export function displayTitle(title: string) {
  return title.replace(/<\/?b>/gi, "").replace(/\\\$/g, "$").trim();
}
export type Jacket = {file:string;source?:string; custom?:boolean};
import manifest from "./jackets.json";
export function jacketFor(book:{title:string;author:string;cover:string}):Jacket|undefined {
 const entry=(manifest as Record<string,Jacket>)[displayTitle(book.title)+"|"+book.author.trim()];
 if(book.cover && entry?.file.startsWith("/covers/") && !entry.file.includes(book.cover))return undefined;
 return entry;
}
