# Probar el plugin

Guía corta para quien quiera instalar y probar el plugin CRS Design System en
Penpot. No hace falta instalar nada en el ordenador.

## Qué necesitas

- Una cuenta de Penpot. Sirve la versión de nube y la de escritorio.
- Penpot 2.5 o superior, que es la versión con soporte de plugins. Si tu Penpot
  es más antiguo, el gestor de plugins ni aparece.
- Un archivo de Penpot abierto o uno nuevo. El plugin trabaja sobre el archivo
  que tengas delante.

## Cómo se instala

1. Abre Penpot y entra en el archivo donde quieras probarlo.
2. Abre el gestor de plugins de ese archivo.
3. Elige instalar un plugin por URL.
4. Pega esta dirección:

   ```
   https://CRS-DISENO.github.io/crs-design-system-penpot/manifest.json
   ```

5. Confirma. El plugin aparece en el menú de plugins del archivo.
6. Ábrelo desde ese menú.

## Qué hacer dentro

1. Si quieres usar tu propio logotipo, arrastra su archivo SVG sobre la ventana
   del plugin. Es la única forma de dárselo: un plugin no puede leer tu disco.
   Si no arrastras nada, se usa el logotipo de CRS.
2. Rellena el brief si quieres cambiar el propósito, los pilares o los
   distintivos. Puedes dejarlo como viene.
3. Pulsa generar y espera unos segundos.

## Qué vas a ver

Tres páginas de 1280 px de ancho, dibujadas dentro del archivo:

- **00 Portada**: el nombre, el propósito del sistema y los cinco pilares.
- **01 Índice**: el menú de secciones con su estado.
- **02 Marca**: el logotipo en sus tres variantes, el símbolo y el playhead como
  recursos, tamaños mínimos a tamaño real, área de respeto, reglas de uso, usos
  incorrectos y fondos admitidos.

Además se crea una biblioteca compartida con los colores y las tipografías, así
que aparecen en los paneles del archivo como recursos, no como formas sueltas.

El plugin dibuja una vez. Si después mueves o editas algo en el lienzo, no se
sincroniza solo: hay que volver a generar.

## Si algo no funciona

- **El manifest no carga justo después de una actualización.** Espera un minuto
  y vuelve a intentarlo. El servicio que sirve la dirección necesita un momento.
- **El gestor de plugins no aparece.** Revisa la versión de Penpot: hace falta
  2.5 o superior.
- **Mi logotipo sale deformado.** El plugin lee la proporción del propio archivo
  SVG. Si el SVG viene con un `viewBox` raro, la proporción sale rara también.
  Prueba con el archivo original del logotipo.

## Qué conviene contarnos

Si algo falla, ayuda mucho saber:

- qué paso era y qué esperabas que pasara;
- qué pasó en su lugar, con una captura si puedes;
- la versión de Penpot y si era la de nube o la de escritorio;
- si habías arrastrado un logotipo propio.

Con eso se reproduce el problema mucho más rápido.

## Contacto

`info@crsdiseno.com`
