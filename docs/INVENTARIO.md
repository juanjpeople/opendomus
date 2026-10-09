# Inventario

Cómo se recorre el inventario, qué hace la cámara y cómo probarlo en un celular.
La referencia visual está en `/design` → Flujos → Almacenamiento: usa las mismas vistas
que la app, con una casa de ejemplo en memoria.

## Navegación

| Página | Ruta | Qué tiene |
| --- | --- | --- |
| Inicio de Inventario | `/inventario` | Buscador, "Para reponer", "Recientes" y la casa en la vista elegida. |
| Recinto | `/inventario/lugar?id=` | Resumen, lo que hay que reponer ahí y sus muebles en plano, lista o tarjetas. |
| Contenedor | `/inventario/ver?id=` | Ruta tocable, escena, compartimentos, productos, anotaciones y fotos. |
| Ficha de un producto | `/inventario/ver?id=…&item=` | La misma página del contenedor, con la ficha abierta y la fila resaltada. |
| Cámara | `/inventario/camara` (`?id=`, `?space=`) | Escanear QR, Buscar y AR espacial (experimental). |

- **Ruta tocable.** En el recinto, el contenedor y la ficha, `PathCrumbs` muestra
  Inventario › Recinto › Mueble › Cajón. Cada tramo abre su página y mide 44 px. En celular
  las migas de la cabecera no aparecen: esta ruta es la forma de subir un nivel.
- **Llegar a un producto.** El buscador, Ctrl+K y "Para reponer" llevan a la ficha del
  producto (`?item=`), no solo a su caja. Al cerrar la ficha, el `item` sale de la URL.
- **Enlaces viejos.** `/inventario#recinto-<id>` abre la página del recinto. Los QR
  impresos (`/c/<código>`) siguen abriendo el contenedor, también sin conexión.
- **Al borrar** un contenedor se vuelve a su padre o a su recinto. Al crear un recinto
  se entra a su página para cargarle los muebles.

## Vistas

Cada perfil elige cómo ver su casa y la app lo recuerda (`inventoryView` y `spaceView`
en las preferencias del perfil).

- **Lugares** (por defecto en el inicio): una tarjeta por recinto con su mini plano.
  Cada mueble se puede tocar y muestra un punto si tiene algo para reponer. Lo que no
  entra se resume en "+N".
- **Plano** (por defecto en un recinto): los muebles apoyados en el piso del ambiente.
- **Lista**: el árbol recinto › contenedor › compartimento, con barra de stock y
  compartimentos plegables.
- **Tarjetas**: todos los contenedores, también los anidados, con filtro por recinto y
  orden por nombre, cantidad o lo que hay que reponer.

## Página del contenedor

Primero, lo que tiene. Agregar algo es siempre un botón en su sección:

1. Compartimentos (si tiene).
2. Productos: "Agregar producto" abre un diálogo con el catálogo y el formulario.
3. Anotaciones ("Qué hay acá"): "Nueva anotación" abre el campo, y queda abierto para
   anotar varias cosas seguidas.
4. Fotos.

Un contenedor vacío muestra un solo estado vacío con las tres formas de agregar. Al
entrar, la escena se abre: la tapa, el cajón o la manija se mueve y asoma algo de adentro.
Con "reducir movimiento" no se mueve.

La ficha de un producto muestra, en este orden:

1. La cantidad, con "Usé uno" y "Agregar a la lista".
2. Dónde está, con "Mover a…".
3. El consumo de los últimos 30 días.
4. Los datos, plegados.
5. Los precios.

## Cámara

**Lectura.** La cámara pide resolución alta (1920 × 1080 si el equipo la da), enfoque
continuo y la lente trasera principal. Muchos celulares, como el Galaxy A55, entregan el
gran angular cuando solo se pide "la de atrás". La app reconoce las lentes por su nombre:
`camera2 0, facing back` en Android y `Back Camera` en iPhone. La elección se recuerda en
el dispositivo y se puede cambiar con el botón de lente. El zoom de 1×, 2× y 3× aparece
solo si la cámara lo permite.

El lector usa `BarcodeDetector` del navegador cuando lee QR: lee varias etiquetas por
cuadro y a resolución completa. Si no está, usa jsQR (empaquetado, sin red) sobre un
recorte central en alta resolución y después sobre el cuadro entero. Las imágenes no
salen del dispositivo. Con jsQR se detecta una etiqueta por cuadro; la lectura simultánea
de varias etiquetas requiere que el navegador ofrezca `BarcodeDetector` con soporte QR.

**Modos:**

- **Escanear QR:** abre la caja de la primera etiqueta que lee. Si no hay cámara, se
  puede escribir el código de cuatro caracteres.
- **Buscar** (AR por etiquetas): se apunta a una estantería y cada etiqueta a la vista
  muestra una burbuja con su contenido. Con algo escrito en "¿Qué buscás?", se resaltan
  las cajas que lo tienen y se atenúan las demás. Al costado se lista dónde más hay.
  Tocar una burbuja abre la caja, o la ficha si coincide un solo producto. Si está dentro
  de un compartimento, abre ese compartimento con la ficha del producto. Funciona en
  cualquier celular con cámara y no depende de ARCore. Las posiciones no se pierden:
  las etiquetas están pegadas en las cajas.
- **AR espacial (experimental):** WebXR con tarjetas fijadas en el espacio. Solo dura
  la sesión. Si no está disponible, la pantalla dice por qué, para poder reportarlo:
  - sin `navigator.xr`;
  - sin `immersive-ar`;
  - o el nombre del error que devolvió el navegador.

## Etiquetas

| Tamaño | Medidas | QR aprox. | Para qué |
| --- | --- | --- | --- |
| Chica | 50 × 25 mm | 21 mm | Cajas chicas y frascos. |
| Brother | 62 × 29 mm | 25 mm | Rollos de etiquetadora. |
| Hoja A4 | 63,5 × 38,1 mm, 3 por fila | 34 mm | Imprimir muchas juntas. |
| Estante | 100 × 50 mm, 2 por fila | 46 mm | Leer una estantería desde lejos. |

**Distancias de lectura:** son estimaciones y faltan medir. Como referencia, con la lente
principal en 1080p un QR se lee hasta unas 15 a 25 veces su lado. Una etiqueta de 25 mm
se leería a unos 40 a 60 cm, y cerca de 1 m con 2×. La de estante, a 1,5 m o más. Las
medidas reales en el Galaxy A55 se anotan acá cuando se prueben (ver "Probar en un
celular").

## Probar en un celular

Chrome solo permite instalar la app, usar la cámara y el cifrado en un **contexto seguro**:
HTTPS o `localhost`. Por eso, abrir `http://192.168.x.x:3000` desde el celular sirve para
mirar, pero no ofrece "Instalar app" ni deja usar la cámara.

**Opción rápida, por USB y sin certificados:**

1. En la PC: `npm run build && npm start` (sirve `out/` en `localhost:4173`).
2. En el celular: activá las opciones de desarrollador y la depuración USB, y conectalo.
3. En Chrome de la PC: `chrome://inspect` → Port forwarding → `4173` → `localhost:4173`.
4. En Chrome del celular: `http://localhost:4173`. Es `localhost`, así que la cámara
   funciona y el menú ofrece "Instalar app".

**Publicada:** la dirección de producción (HTTPS) se instala desde el menú de Chrome →
"Instalar app" o "Agregar a la pantalla principal". En Ajustes → Acerca de aparece el
botón de instalar cuando el navegador lo ofrece.

Qué medir en una prueba física:

- la distancia de lectura de cada tamaño de etiqueta con 1× y 2×;
- Buscar frente a una estantería con varias etiquetas a la vez;
- el recorrido completo inicio → recinto → contenedor → ficha → volver por la ruta;
- el diagnóstico que muestra AR espacial.
