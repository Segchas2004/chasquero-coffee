import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bean, Check, ClipboardCheck, Droplets, Hand, Layers, Leaf, PackageCheck, Sprout, Sun, X } from 'lucide-react';
import './coffee-process.css';

const HARVEST = '/origen/cosecha-selectiva.png';
const WET_PROCESS = '/origen/despulpado-cafe.png';
const PARCHMENT = '/origen/secado-pergamino.png';

export const coffeeProcess = [
  {
    name:'Cosecha', phase:'EN EL CAFETAL', icon:Hand, image:HARVEST,
    alt:'Recolección de una cereza madura directamente del cafeto, imagen referencial',
    title:'La calidad empieza al recoger el fruto.',
    summary:'Se recolectan las cerezas maduras y se procura mantenerlas separadas de los frutos verdes, secos o deteriorados.',
    details:'La cosecha da inicio al recorrido del lote. Una recolección cuidadosa ayuda a conservar la calidad del fruto antes de su transformación.',
    points:['Elegir frutos en su punto de madurez.','Usar recipientes limpios durante la recolección.','Trasladar la cosecha al beneficio sin demoras innecesarias.'],
    result:'Cerezas recolectadas y preparadas para su selección.',
    care:'La madurez del fruto es el punto de partida; la apariencia final del café se construye también en las etapas siguientes.',
  },
  {
    name:'Selección', phase:'CUIDAR EL LOTE', icon:Leaf, image:'/origen/seleccion-cerezas.png',
    alt:'Selección manual de cerezas de café sobre una bandeja, imagen referencial',
    title:'Separar bien también es cuidar la calidad.',
    summary:'Se retiran impurezas y frutos que no reúnen las condiciones para continuar junto al lote seleccionado.',
    details:'La clasificación permite trabajar con una materia prima más uniforme. Conviene conservar la identificación y evitar la mezcla indiscriminada de cosechas.',
    points:['Retirar hojas, ramas y otras materias extrañas.','Separar frutos verdes, secos o dañados.','Mantener identificado el origen del lote.'],
    result:'Un lote seleccionado antes del despulpado.',
    care:'La limpieza y la separación del café acompañan todo el proceso, no solo esta primera selección.',
  },
  {
    name:'Despulpado', phase:'BENEFICIO LAVADO', icon:Bean, image:WET_PROCESS,
    alt:'Despulpadora separando la pulpa de las cerezas de café, imagen referencial',
    title:'De la cereza al grano protegido.',
    summary:'La despulpadora separa la pulpa del fruto. El grano conserva su pergamino y una capa de mucílago.',
    details:'Este paso transforma el fruto seleccionado. El estado y el ajuste del equipo ayudan a evitar daños durante la separación de la pulpa.',
    points:['Trabajar con equipos limpios y bien ajustados.','Evitar daños mecánicos en el grano.','Conservar la separación e identificación de los lotes.'],
    result:'Café despulpado con mucílago, listo para continuar.',
    care:'Esta guía describe el proceso lavado. Los métodos natural y honey siguen recorridos distintos.',
  },
  {
    name:'Fermentación y lavado', phase:'BENEFICIO LAVADO', icon:Droplets, image:'/origen/lavado-cafe.png',
    alt:'Lavado de café despulpado con agua limpia, imagen referencial',
    title:'Retirar el mucílago con cuidado.',
    summary:'En este recorrido, la fermentación facilita desprender el mucílago y el lavado con agua limpia permite retirarlo.',
    details:'Las condiciones del proceso influyen en el momento de finalizar la fermentación. No existe una duración única que sirva para todos los lotes.',
    points:['Controlar el proceso según las condiciones del lote.','Realizar el lavado con agua limpia.','Escurrir y continuar oportunamente con el secado.'],
    result:'Café lavado, todavía protegido por su pergamino.',
    care:'Cada productor ajusta y controla el beneficio de acuerdo con su método y las condiciones del lote.',
  },
  {
    name:'Secado', phase:'CONSERVAR LA CALIDAD', icon:Sun, image:PARCHMENT,
    alt:'Café pergamino en una cama de secado protegida, imagen referencial',
    title:'El secado se comprueba, no se adivina.',
    summary:'Se reduce la humedad del café mediante un secado uniforme, con protección frente a contaminación y rehumedecimiento.',
    details:'La humedad se verifica con un método o equipo adecuado. El tiempo necesario depende del sistema de secado y de las condiciones ambientales.',
    points:['Distribuir el café de manera uniforme.','Protegerlo de lluvia, suciedad y humedad externa.','Comprobar la humedad antes de almacenarlo.'],
    result:'Café pergamino seco para su conservación.',
    care:'Antes de ofrecer el lote, coordina la medición de humedad y confirma las condiciones de recepción con la empresa.',
  },
  {
    name:'Almacenamiento', phase:'PROTEGER EL PERGAMINO', icon:Layers, image:'/origen/almacen-cafe.png',
    alt:'Sacos de café sobre tarimas en un almacén limpio, imagen referencial',
    title:'Conservar lo que se cuidó en el campo.',
    summary:'El pergamino seco se conserva en empaques limpios, en un ambiente protegido y con el lote identificado.',
    details:'Un café bien secado puede deteriorarse si vuelve a absorber humedad o si se contamina durante su almacenamiento.',
    points:['Usar empaques limpios y adecuados para café.','Colocar los sacos sobre tarimas, separados de las paredes.','Mantener el lote en un espacio seco y limpio.'],
    result:'Un lote protegido, identificado y disponible para evaluación.',
    care:'El pergamino conserva la cubierta del grano: en esta presentación todavía no se ha tostado el café.',
  },
  {
    name:'Evaluación del lote', phase:'ANTES DE ACORDAR LA COMPRA', icon:ClipboardCheck, image:'/origen/evaluacion-cafe.png',
    alt:'Evaluación de una muestra de café con medidor de humedad y balanza, imagen referencial',
    title:'Conocer el lote antes de valorar la compra.',
    summary:'Con Chasquero Coffee se coordina la evaluación del café: presentación, peso, humedad y rendimiento comercial.',
    details:'El análisis del lote permite conversar sobre sus condiciones. El rendimiento y la humedad se obtienen de la evaluación, no de una fotografía ni de esta guía.',
    points:['Indicar procedencia, presentación y cantidad.','Coordinar la revisión del lote con la empresa.','Confirmar el precio que corresponde al rendimiento evaluado.'],
    result:'Información del lote para acordar las condiciones de compra.',
    care:'El rendimiento comercial utilizado por el sistema no equivale a una puntuación de catación. El precio se confirma directamente con la empresa.',
  },
  {
    name:'Listo para ofrecer', phase:'EL SIGUIENTE ENCUENTRO', icon:PackageCheck, image:'/origen/cafe-listo-venta.png',
    alt:'Lote de café pergamino ensacado y preparado para ofrecerlo, imagen referencial',
    title:'Un café preparado. Una venta por coordinar.',
    summary:'Con el lote preparado e identificado, el productor puede ofrecerlo y acordar su recepción y las condiciones de compra.',
    details:'La venta de café pergamino puede realizarse en esta presentación. El trillado o el tostado pertenecen a etapas posteriores, según el destino del café.',
    points:['Confirmar cantidad y presentación disponibles.','Acordar precio y condiciones de recepción.','Coordinar el traslado antes de salir con el café.'],
    result:'Un lote listo para ofrecer a la empresa.',
    care:'Chasquero Coffee confirma la aceptación del lote y las condiciones acordadas antes de recibirlo.',
  },
];

const offerLink = '/contacto?motivo='+encodeURIComponent('Quiero ofrecer mi café');
function StageBullets({index}:{index:number}) {
  return <ul className="cc-process-bullets">{coffeeProcess[index].points.map(point=><li key={point}><span><Check size={14} aria-hidden="true"/></span>{point}</li>)}</ul>;
}
function StageButtons({active,onSelect,dialog=false}:{active:number;onSelect:(value:number)=>void;dialog?:boolean}) {
  function select(value:number){onSelect(value);if(dialog)requestAnimationFrame(()=>document.getElementById('cc-process-dialog-title')?.focus({preventScroll:true}))}
  return <div className="cc-process-controls"><button type="button" className="cc-process-nav-button" disabled={active===0} aria-label={dialog?'Etapa anterior en el detalle':'Ver etapa anterior'} onClick={()=>select(active-1)}><ArrowLeft size={18}/><span>Anterior</span></button><span aria-live="polite" aria-atomic="true">{String(active+1).padStart(2,'0')} <i>/</i> 08</span><button type="button" className="cc-process-nav-button" disabled={active===coffeeProcess.length-1} aria-label={dialog?'Etapa siguiente en el detalle':'Ver etapa siguiente'} onClick={()=>select(active+1)}><span>Siguiente</span><ArrowRight size={18}/></button></div>;
}

export function CoffeeProcessPage({active,onSelect,onOpen}:{active:number;onSelect:(value:number)=>void;onOpen:()=>void}) {
  const stage=coffeeProcess[active];
  return <section className="cc-process cc-wrap cc-section" aria-labelledby="cc-process-title" id="recorrido-del-cafe">
    <div className="cc-section-intro" data-reveal><div><p className="cc-eyebrow">CADA PASO DEJA SU HUELLA</p><h2 id="cc-process-title">De la cosecha.<br/><em>A un café listo para ofrecer.</em></h2></div><p>Explora ocho etapas del café pergamino de proceso lavado. Una guía para entender su recorrido; los métodos y las condiciones se adaptan a cada productor y lote.</p></div>
    <div className="cc-process-caption"><span><Sprout size={16}/>GUÍA INTERACTIVA DEL PERGAMINO</span><small>Elige una etapa o avanza paso a paso.</small></div>
    <div className="cc-process-layout">
      <nav className="cc-process-index" aria-label="Etapas del proceso del café"><ol>{coffeeProcess.map((item,index)=><li key={item.name}><button type="button" aria-current={active===index?'step':undefined} aria-controls="cc-process-stage" onClick={()=>onSelect(index)}><span className="cc-process-index-thumb"><img src={item.image} alt="" width="80" height="80" loading="lazy"/><small>{String(index+1).padStart(2,'0')}</small></span><span className="cc-process-index-text"><small>{item.phase}</small>{item.name}</span><item.icon size={19} strokeWidth={1.4} aria-hidden="true"/></button></li>)}</ol></nav>
      <article className="cc-process-stage" id="cc-process-stage" aria-labelledby="cc-stage-title">
        <div className="cc-process-stage-photo" key={stage.image+active}><img src={stage.image} alt={stage.alt} width="1536" height="1024"/><span className="cc-process-photo-count">{String(active+1).padStart(2,'0')}<small>DE 08</small></span><small className="cc-process-photo-reference">Imagen referencial</small></div>
        <div className="cc-process-stage-body" key={active}><span className="cc-process-phase"><stage.icon size={19} strokeWidth={1.4}/>{stage.phase}</span><h3 id="cc-stage-title">{stage.title}</h3><p>{stage.summary}</p><StageBullets index={active}/><div className="cc-process-result"><Check size={18}/><span><small>LO QUE SE OBTIENE</small>{stage.result}</span></div><button type="button" className="cc-button cc-primary" onClick={onOpen} aria-haspopup="dialog"><span>Ver esta etapa en detalle</span><span className="cc-action-icon"><ArrowUpRight size={18}/></span></button></div>
        <div className="cc-process-stage-footer"><progress value={active+1} max={coffeeProcess.length} aria-label="Avance del recorrido"/><StageButtons active={active} onSelect={onSelect}/></div>
      </article>
    </div>
    <div className="cc-process-final" data-reveal><span className="cc-process-final-icon"><PackageCheck size={35} strokeWidth={1.2}/></span><div><p className="cc-eyebrow">EL SIGUIENTE PASO ES CONTIGO</p><h3>¿Tu café ya está preparado?</h3><p>Cuéntanos su procedencia, presentación y cantidad. Coordina las condiciones antes de trasladarlo.</p></div><Link className="cc-button cc-primary" to={offerLink}><span>Quiero ofrecer mi café</span><span className="cc-action-icon"><ArrowUpRight size={18}/></span></Link></div>
    <details className="cc-process-sources"><summary>Sobre esta guía y sus referencias técnicas<ArrowUpRight size={16}/></summary><p>Recorrido orientativo del beneficio lavado y la comercialización de café pergamino. Las etapas técnicas se apoyan en publicaciones de Cenicafé; la evaluación de humedad, rendimiento y precio se coordina con Chasquero Coffee. Las imágenes son ilustrativas.</p><a href="https://biblioteca.cenicafe.org/handle/10778/4344" target="_blank" rel="noopener noreferrer">Cenicafé · Proceso de beneficio<ArrowUpRight size={15}/></a><a href="https://publicaciones.cenicafe.org/index.php/infografias/article/view/2884" target="_blank" rel="noopener noreferrer">Cenicafé · Secado y almacenamiento<ArrowUpRight size={15}/></a><a href="https://www.comsa.hn/beneficio-humedo/" target="_blank" rel="noopener noreferrer">COMSA · Beneficio húmedo<ArrowUpRight size={15}/></a></details>
  </section>;
}

export function CoffeeProcessTeaser(){return <section className="cc-process-teaser cc-wrap" aria-labelledby="cc-process-teaser-title" data-reveal><div className="cc-process-teaser-image"><img src={PARCHMENT} alt="Café pergamino durante el secado, imagen referencial" width="1536" height="1024" loading="lazy"/><span>DE LA CEREZA AL PERGAMINO<small>Imagen referencial</small></span></div><div className="cc-process-teaser-copy"><p className="cc-eyebrow">EL VALOR ESTÁ EN CADA ETAPA</p><h2 id="cc-process-teaser-title">Una cosecha.<br/><em>Mucho por contar.</em></h2><p>Descubre cómo el fruto se transforma en café pergamino preparado para ofrecerlo: selección, beneficio, secado y cuidado del lote.</p><div className="cc-process-teaser-route"><span><i/>Cosecha</span><ArrowRight size={15}/><span><i/>Beneficio</span><ArrowRight size={15}/><span><i/>Venta</span></div><Link className="cc-button cc-primary" to="/proceso-del-cafe"><span>Explorar las ocho etapas</span><span className="cc-action-icon"><ArrowUpRight size={18}/></span></Link></div></section>}

export function CoffeeProcessModal({open,active,onSelect,onClose}:{open:boolean;active:number;onSelect:(value:number)=>void;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null),body=useRef<HTMLDivElement>(null);const stage=coffeeProcess[active];
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open]);
  useEffect(()=>{body.current?.scrollTo({top:0,behavior:'instant'});if(open&&ref.current?.open&&document.activeElement===document.body)body.current?.focus({preventScroll:true})},[active,open]);
  return <dialog className="cc-process-dialog" ref={ref} aria-labelledby="cc-process-dialog-title" aria-describedby="cc-process-dialog-summary" onClose={onClose} onKeyDown={e=>{if(e.key!=='Tab')return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')).filter(item=>item.getClientRects().length>0);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}} onClick={e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onClose()}}}>
    <div className="cc-process-dialog-top"><span><Bean size={19} strokeWidth={1.3}/>EL RECORRIDO DEL CAFÉ</span><button type="button" className="cc-process-close" aria-label="Cerrar detalle del proceso" onClick={onClose} autoFocus><X size={21}/></button></div>
    <div className="cc-process-dialog-body" ref={body} tabIndex={0} role="region" aria-label="Contenido de la etapa"><div className="cc-process-dialog-image" key={active}><img src={stage.image} alt={stage.alt} width="1536" height="1024"/><span className="cc-process-dialog-number">{String(active+1).padStart(2,'0')}<small>DE OCHO ETAPAS</small></span><small>Imagen referencial</small></div><div className="cc-process-dialog-copy" key={stage.name}><span className="cc-process-phase"><stage.icon size={19}/>{stage.phase}</span><h2 id="cc-process-dialog-title" tabIndex={-1}>{stage.name}</h2><p id="cc-process-dialog-summary" className="cc-process-dialog-summary">{stage.summary}</p><p>{stage.details}</p><h3>Qué se cuida en esta etapa</h3><StageBullets index={active}/><div className="cc-process-result"><Check size={18}/><span><small>LO QUE SE OBTIENE</small>{stage.result}</span></div><p className="cc-process-care">{stage.care}</p>{active===coffeeProcess.length-1&&<Link className="cc-button cc-primary" to={offerLink} onClick={onClose}><span>Coordinar con la empresa</span><span className="cc-action-icon"><ArrowUpRight size={18}/></span></Link>}</div></div>
    <div className="cc-process-dialog-bottom"><progress value={active+1} max={coffeeProcess.length} aria-label="Avance del detalle"/><StageButtons active={active} onSelect={onSelect} dialog/></div>
  </dialog>;
}
