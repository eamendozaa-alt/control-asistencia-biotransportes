# Guías de Transportista

Web app (HTML/CSS/JS, sin dependencias ni servidor) para preparar y controlar las
Guías de Remisión Electrónicas Transportista (GRE-T) de SUNAT a partir de la guía
del remitente.

## Uso

Abrir `index.html` en el navegador, o publicarlo como sitio estático (GitHub Pages,
Cloudflare Pages, etc.). Funciona bien en celular.

1. **Catálogos**: registre clientes, vehículos y conductores una sola vez.
2. **Guías → + Nueva**: ingrese el número de la guía del remitente (ej. `T001-00022562`)
   y complete el traslado. RUC, DNI y placa se validan; los catálogos autocompletan.
3. **Hoja**: muestra los datos en el orden del formulario de SUNAT, con botón *Copiar*
   por campo e *Imprimir / PDF*.
4. Emita la GRE-T en SUNAT y registre el número resultante en la guía (estado *Emitida*).
5. **Respaldo**: descargue un JSON con frecuencia.

## Datos

Por ahora se guardan en `localStorage` del navegador (etapa de prueba). No se
comparten entre dispositivos. Siguiente paso previsto: base de datos en la nube.

## Emisión automática en SUNAT (pendiente)

Requiere un servidor propio y credenciales oficiales de API de SUNAT (client_id y
client_secret del menú SOL, usuario secundario con permiso GRE). **Nunca** guarde la
clave SOL ni secretos en este front-end ni en el repositorio.
