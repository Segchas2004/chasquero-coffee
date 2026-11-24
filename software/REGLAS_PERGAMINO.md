# Liquidación y secado del café pergamino

Reglas confirmadas por el propietario el 24/11/2026. Sustituyen las sugerencias anteriores para operaciones nuevas. Las compras y ventas guardadas conservan sus importes.

1. Registramos el peso bruto en kg, la humedad leída y el rendimiento entero entre 40 y 80.
2. Tomamos la parte entera de la humedad sin redondear: 14.99 % aplica 14 %. Conservamos también la lectura original.
3. Aplicamos el divisor de la tabla. Dividimos el peso entre el divisor y truncamos el resultado a dos decimales.
4. Multiplicamos ese resultado por el precio del rendimiento y descartamos los céntimos finales. El rendimiento selecciona el precio; no se vuelve a multiplicar por 70 u otro valor.
5. Sobre 40 %, Almacén o dirección registra un divisor manual igual o mayor a 75.5, con una especificación del criterio aplicado al lote. El servidor bloquea un divisor menor. Admitimos humedad hasta 100 %.

Ejemplo ficticio: 50 kg, humedad 15.99 %, rendimiento 70, tarifa S/ 980. Aplicamos 15 %, divisor 56.5, unidades 0.88, importe S/ 862.40 y pago S/ 862.

| Humedad aplicada % | Divisor | Clasificación |
|---|---:|---|
| 1 | 55.5 | Seco |
| 2 | 55.5 | Seco |
| 3 | 55.5 | Seco |
| 4 | 55.5 | Seco |
| 5 | 55.5 | Seco |
| 6 | 55.5 | Seco |
| 7 | 55.5 | Seco |
| 8 | 55.5 | Seco |
| 9 | 55.5 | Seco |
| 10 | 55.5 | Seco |
| 11 | 55.5 | Seco |
| 12 | 55.5 | Seco |
| 13 | 55.5 | Semi seco |
| 14 | 56 | Semi seco |
| 15 | 56.5 | Semi seco |
| 16 | 57 | Húmedo |
| 17 | 57.5 | Húmedo |
| 18 | 58 | Húmedo |
| 19 | 59 | Húmedo |
| 20 | 60 | Húmedo |
| 21 | 60.6 | Húmedo |
| 22 | 61.2 | Húmedo |
| 23 | 61.8 | Húmedo |
| 24 | 62.4 | Húmedo |
| 25 | 63 | Húmedo |
| 26 | 63.6 | Húmedo |
| 27 | 64.2 | Húmedo |
| 28 | 64.8 | Húmedo |
| 29 | 65.4 | Húmedo |
| 30 | 68.5 | Húmedo |
| 31 | 69.2 | Húmedo |
| 32 | 69.9 | Húmedo |
| 33 | 70.6 | Húmedo |
| 34 | 71.3 | Húmedo |
| 35 | 72 | Húmedo |
| 36 | 72.7 | Húmedo |
| 37 | 73.4 | Húmedo |
| 38 | 74.1 | Húmedo |
| 39 | 74.8 | Húmedo |
| 40 | 75.5 | Húmedo |

## Control del secado

Procesamiento permite analizar y enviar un lote húmedo de pergamino. Registramos lote, fecha, peso enviado y especificación del secado. El análisis previo usa peso final esperado, humedad esperada, precio del rendimiento seco y costo previsto del secado, con la misma fórmula de liquidación. Es una estimación; no genera una venta ni un cobro.

Al confirmar, el peso enviado y su costo proporcional se separan del lote disponible. El envío queda en estado En secado y no admite edición. No se vende ni se vuelve a procesar ese peso. Si enviamos solo parte de un lote, el remanente conserva su disponibilidad. No se consume café reservado para una venta pendiente. Se muestra la fecha, el peso, la humedad de origen y el operador. La compra original no cambia.

Al regresar elegimos el envío pendiente, registramos código del lote seco, peso real, humedad final, rendimiento verificado, precio de referencia del rendimiento y costo técnico real. La humedad final debe quedar entre 1 y 15 % después de truncar; si sigue húmedo, el envío continúa pendiente. La merma real es peso enviado menos peso final. El nuevo lote conserva el productor, la procedencia y el vínculo con el original.

El costo del lote seco es el costo asignado del café comprado más el secado. Incluir este costo no registra un pago: Caja registra el gasto cuando se efectúe. La valoración del regreso usa el peso real, su divisor y el precio de referencia. El margen mostrado es estimado y no equivale a dinero cobrado ni a utilidad neta. La ganancia sobre la venta se conoce cuando se registra esa venta, con su precio efectivo y el costo del lote.

Los lotes que regresan del secado se venden con la misma fórmula de liquidación. Caja requiere una tarifa de venta por rendimiento autorizada. Una tarifa antigua por kilo no se convierte automáticamente. Administración puede registrar una excepción con motivo. Las otras presentaciones mantienen su unidad vigente.

Dirección puede cancelar un envío pendiente solo confirmando que regresó íntegramente sin procesamiento, con fecha y motivo. Un secado terminado conserva su historial. Las anulaciones comprueban que no existan salidas posteriores antes de compensar stock.

## Tarifas y publicación

Los importes de ejemplo son ficticios. El propietario debe confirmar las tarifas reales antes de compras o ventas de negocio. La configuración del proyecto permite Authentication y Firestore, con API en Functions y web en Hosting. La publicación y su prueba en Internet son verificaciones separadas del entorno local.
