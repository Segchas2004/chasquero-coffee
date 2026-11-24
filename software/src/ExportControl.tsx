import { useState } from 'react';
import { Download } from 'lucide-react';
export default function ExportControl({href,label='tabla'}:{href:string;label?:string}){
 const [format,setFormat]=useState('pdf');
 return <div className="export-control"><select aria-label={`Formato de exportación de ${label}`} value={format} onChange={e=>setFormat(e.target.value)}><option value="pdf">PDF</option><option value="csv">CSV · Excel</option></select><a className="button" href={`${href}${href.includes('?')?'&':'?'}format=${format}`} download aria-label={`Exportar ${label} en ${format.toUpperCase()}`}><Download size={16}/>Exportar {format.toUpperCase()}</a></div>;
}
