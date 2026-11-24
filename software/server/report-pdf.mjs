import PDFDocument from 'pdfkit';

export const reportTitles={prices:'Tarifario del café',purchases:'Compras a productores',sales:'Ventas de café',inventory:'Inventario y trazabilidad',cash:'Movimientos de caja',processes:'Procesamiento y mermas',summary:'Resumen de gestión',audit:'Historial de auditoría',statistics:'Indicadores para decisiones',monthly:'Evolución mensual',partners:'Productores y clientes',quality:'Compras por rendimiento',balances:'Saldos y antigüedad',returns:'Devoluciones completas','stock-alerts':'Disponibilidad y alertas de inventario'};

export function reportPdf({kind,headers,rows,company='Chasquero Coffee',environment,period,filters,user}) {
  return new Promise((resolve,reject)=>{
    if(headers[0]==='Entorno'){headers=headers.slice(1);rows=rows.map(r=>r.slice(1));}
    const recordLayout=kind==='audit'||headers.length>12;
    const doc=new PDFDocument({size:headers.length>8&&!recordLayout?'A3':'A4',layout:recordLayout?'portrait':'landscape',margin:36,bufferPages:true,info:{Title:reportTitles[kind]||kind,Author:company}});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    const width=()=>doc.page.width-72;
    const head=()=>{
      doc.fillColor('#70472a').font('Helvetica-Bold').fontSize(19).text(company,36,30,{width:width()});
      doc.fontSize(12).text(reportTitles[kind]||kind,36,56,{width:width()});
      doc.font('Helvetica').fontSize(8).fillColor('#7d6b59').text(`${environment} | ${period} | Emitido por ${user}`,36,76,{width:width()});
      doc.text(`Filtros: ${filters || 'Sin filtros adicionales'} | Registros: ${rows.length}`,36,89,{width:width()});
      doc.moveTo(36,106).lineTo(doc.page.width-36,106).strokeColor('#d7bc9d').stroke();doc.y=119;
    };
    head();
    const next=()=>{doc.addPage();head();};
    if(!rows.length)doc.fontSize(11).fillColor('#715d4d').text('No hay registros para los filtros seleccionados.',36,125);
    if(recordLayout){
      rows.forEach((row,index)=>{
        if(doc.y>doc.page.height-100)next();
        doc.fillColor('#895b36').font('Helvetica-Bold').fontSize(10).text(`Registro ${index+1}`,36,doc.y,{width:width()});doc.moveDown(.5);
        headers.forEach((label,i)=>{
          const text=String(row[i]??'');
          if(doc.y>doc.page.height-85)next();
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#694c35').text(label,{width:width()});
          doc.font('Helvetica').fontSize(8).fillColor('#4d4036');
          // Una celda extensa continúa por páginas, sin recortar el contenido.
          const paragraphs=text.match(/[\s\S]{1,700}/g)||['—'];
          for(const paragraph of paragraphs){
            const h=doc.heightOfString(paragraph,{width:width(),lineGap:2});
            if(doc.y+h>doc.page.height-55)next();
            doc.text(paragraph,{width:width(),lineGap:2});
          }
          doc.moveDown(.45);
        });
        doc.moveDown(.6);
      });
    } else {
      const col=width()/headers.length,fontSize=headers.length>8?7.5:9;
      const drawRow=(values,y,header=false,index=0)=>{
        doc.font(header?'Helvetica-Bold':'Helvetica').fontSize(fontSize);
        const height=Math.max(26,...values.map(v=>doc.heightOfString(String(v??''),{width:col-14,lineGap:2})+14));
        doc.rect(36,y,width(),height).fill(header?'#ead5bc':index%2?'#fcf6ee':'#ffffff');
        values.forEach((value,i)=>{doc.fillColor(header?'#5a3d27':'#554538').text(String(value??'—'),36+i*col+7,y+7,{width:col-14,lineGap:2});});
        doc.moveTo(36,y+height).lineTo(doc.page.width-36,y+height).strokeColor('#eadfd1').stroke();return height;
      };
      let y=119;y+=drawRow(headers,y,true);
      rows.forEach((row,index)=>{
        doc.font('Helvetica').fontSize(fontSize);const height=Math.max(26,...row.map(v=>doc.heightOfString(String(v??''),{width:col-14,lineGap:2})+14));
        if(y+height>doc.page.height-55){next();y=119;y+=drawRow(headers,y,true);}
        y+=drawRow(row,y,false,index);
      });
    }
    const pages=doc.bufferedPageRange();
    for(let i=pages.start;i<pages.start+pages.count;i++){
      doc.switchToPage(i);doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(7).fillColor('#8b7661').text(`Chasquero Coffee | Gestión interna | Página ${i+1} de ${pages.count}`,36,doc.page.height-29,{width:width(),lineBreak:false});
    }
    doc.end();
  });
}

