export function displayTitle(title: string) {
  return title.replace(/<\/?b>/gi, "").replace(/\\\$/g, "$").trim();
}
export type Jacket = {file:string;small?:string;spine?:string;depth?:number;pages?:number;edition?:string;heightScale?:number;cloth?:string;source?:string; custom?:boolean};
import manifest from "./jackets.json";
export function jacketFor(book:{title:string;author:string;cover:string}):Jacket|undefined {
 const entry=(manifest as Record<string,Jacket>)[displayTitle(book.title)+"|"+book.author.trim()];
 if(book.cover && entry?.file.startsWith("/covers/") && !entry.file.includes(book.cover))return undefined;
 return entry;
}

// A compressed print scale preserves small bindings at phone sizes.
// Unknown editions retain their art-directed dimensions.
export function bindingDepth(book: Parameters<typeof jacketFor>[0]) {
  const jacket = jacketFor(book);
  return jacket?.pages ? Math.min(62, Math.max(10, Math.round(5 + jacket.pages * .057))) : jacket?.depth ?? 25;
}
