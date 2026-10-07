# Catálogo y precarga opcional

Al crear una casa en el dispositivo o una casa nueva en la nube, se puede empezar
sin precarga o elegir ambientes y contenedores por separado. No se crean Cocina, Taller ni existencias sin
confirmación. Las casas existentes conservan sus datos y las migraciones históricas
siguen resolviendo las antiguas listas Alacena/Taller.

Patrones: Heladera, Alacena, Despensa, Armario de limpieza, Higiene, Cajón de cables
y pilas, útiles de librería, Taller de herramientas y Taller de cerámica. Todos se eligen por separado.
Cada contenedor se asigna a uno de los ambientes seleccionados: limpieza puede ir
en Cocina sin crear Lavadero, y un Garaje puede empezar vacío. Los ambientes se
pueden renombrar y agregar después desde Inventario.
Los tres ejemplos (compra completa/principio de mes, básicos/mediados y queda
poco/fin de mes) son puntos de partida editables, no recomendaciones de consumo,
estimaciones por familia ni una canasta nutricional u oficial. También se pueden
crear solo los espacios. Antes de guardar se pueden quitar artículos y ajustar
cantidades; cambiar de ejemplo restablece las cantidades propuestas.

Los alimentos a granel usan gramos enteros. Los líquidos cuyo envase habitual
es fraccionario se cuentan por envases (unidades), sin redondear 900 ml a 1 litro.
Las herramientas son reutilizables. No se generan sugerencias de reposición ni
compras a partir de cantidades ilustrativas; la persona puede activar reposición
y definir mínimos en cada artículo después.

## Precios de referencia

La selección editorial prioriza productos cotidianos y marcas accesibles donde
hay evidencia pública. No presume ingresos ni obliga a marcas o comercios.
Consulta de páginas públicas: **7 de octubre de 2026**. El archivo
`src/features/prices/references.ts` guarda producto comercial, presentación,
centavos ARS, comercio, URL y fecha de consulta. La UI muestra estos datos en el
catálogo, en la revisión de la precarga y en el detalle de productos reconocidos.
No se guarda ningún precio de referencia como precio pagado por la casa.

Fuentes: fichas de [DIA Argentina](https://diaonline.supermercadosdia.com.ar/)
y [Nuevas Criaturas](https://nuevascriaturas.com.ar/producto/arcilla-blanca-2/).
Cada referencia enlaza la ficha concreta. Son muestras de comercios, no promedios
nacionales, mínimos de mercado ni precios garantizados para una localidad.
No se seleccionó un domicilio ni se inició una compra para comprobar cobertura.
Se utiliza el precio de lista cuando la ficha muestra una promoción; se excluyen
envío, cupones, clubes, financiación y descuentos bancarios.

La consulta usó páginas indexadas: algunas fichas se habían rastreado entre el
mismo día y seis días antes, y otras entre dos semanas y un mes antes. Se marca
`sourceAge: older` en estas últimas y se muestran desde el inicio como referencias
a revisar. Las demás también pasan a revisión a los siete días de la consulta.
La fecha de consulta **no acredita una cotización en vivo**. Hubo diferencias
entre listados y fichas individuales; se conservó el dato de la ficha enlazada.
Los artículos sin evidencia suficiente muestran «Sin precio de referencia
verificado»; no se inventa un importe ni se toma un precio sin impuestos.

## Mantenimiento sin servicios adicionales

No requiere API keys, tarjeta, suscripción, scraping durante el uso ni llamadas
externas para mostrar precios: el catálogo y la instantánea vienen con la app y
funcionan offline. Abrir la fuente es una acción explícita de la persona.
La actualización es editorial, **no automática**: volver a consultar cada ficha,
confirmar presentación/moneda/condiciones, actualizar el importe y fecha reales
y publicar una nueva versión. Si no puede verificarse una referencia, retirarla
o conservarla marcada para revisión. No adelantar fechas para ocultar antigüedad.

## Integridad y verificación

`house-setup/service.ts` solo acepta bases nuevas con perfiles y lista iniciales,
sin vínculo cloud ni datos de la casa. Valida toda la selección antes de escribir
y guarda espacios, contenedores, artículos, configuración del calendario y decisión
inicial en una transacción. Una falla revierte el conjunto completo.
Dos pestañas no pueden duplicar la precarga. Elegir empezar vacío también se
recuerda. Una casa creada en la nube usa después la subida cifrada habitual;
los precios públicos no viajan como historial privado.

Pruebas: `src/features/house-setup/templates.test.ts` cubre niveles, unidades,
validación, persistencia, concurrencia, casas existentes y antigüedad de precios.
`e2e/house-setup.spec.ts` verifica la elección vacía, revisión, edición y exclusión
de productos desde navegador en escritorio y celular. Los demás tests preparan
sus propios espacios de forma explícita, en lugar de depender de defaults.
`e2e/house-setup-cloud.spec.ts` reemplaza solamente el transporte de la API con
respuestas sintéticas: crea claves reales de prueba, sube la precarga cifrada y la
recupera en un segundo navegador independiente. No crea cuentas ni casas reales.

## Feriados y escuela

La ubicación se elige por casa, en la precarga o en **Calendario → Configurar
feriados y escuela**. No se infiere por idioma, correo o ubicación del dispositivo.
La biblioteca local `date-holidays` 3.37.0 incluye fechas nacionales y, donde tiene
datos, estados/provincias y regiones. **Argentina tiene cobertura nacional en este
catálogo**, no un calendario provincial o escolar oficial. La interfaz lo informa;
las fechas locales faltantes se agregan como eventos de tipo **Feriado propio**.
Se muestran feriados públicos; los días opcionales, bancarios o meras observancias
no se presentan como feriados generales. Un catálogo puede quedar desactualizado:
los cambios de fechas requieren actualizar y publicar la app.

Los datos y reglas vienen en los archivos estáticos de la app y su caché offline.
No requieren API key, tarjeta, geolocalización ni facturación. Se conservan las
licencias ISC del código y CC BY-SA 3.0 de los datos, con atribuciones completas en
`public/third-party-notices.txt`. No se modifica el catálogo de origen.

Escuela es opcional. En **Calendario → Nuevo evento**, seleccionar:

- **Materia escolar**: título, alumno(s), primera clase (día de la semana), horario,
  fecha de fin del ciclo y materiales/recordatorios para la mochila. Se repite
  semanalmente hasta esa fecha inclusive. Para otra jornada, cargar otro evento.
- **Tarea escolar**: fecha de entrega, alumno(s) y notas. Los adultos pueden marcarla
  revisada; las pendientes permanecen en el inicio aunque venza su fecha.
- **Sin clases / vacaciones**: período y alumnos afectados; sin participantes, afecta
  a todos. Suspende sus materias durante el período, sin borrar la serie.

En el inicio, los adultos ven las materias de hoy por alumno, los materiales y las
tareas pendientes; el perfil Chico ve las suyas. No se envían notificaciones push:
la agenda aparece al abrir la app. Un feriado avisa que se confirme si hay clases;
no las cancela por su cuenta. Los perfiles se crean/renombran en Familia.

La ubicación y activación de escuela se guardan en `houseSettings`, esquema local
v13, y viajan cifradas con la casa. Las operaciones de esa tabla se separan para
clientes antiguos; al actualizar se recuperan sin repetir consumos de inventario.
Los metadatos escolares viajan con los eventos. Los permisos del calendario se
verifican tanto al escribir como al recibir cambios de otros dispositivos.

Pruebas adicionales: `school.test.ts` cubre límites de ciclo, vacaciones por alumno,
fechas civiles, permisos y compatibilidad. `school-calendar.spec.ts` recorre el
flujo de calendario e inicio en escritorio y celular. La prueba cloud también
comprueba que un segundo dispositivo recibe la activación de escuela.

## Compartir la casa

Desde la casa (no desde `/admin`): **Familia → Casa en la nube → Invitar**.
Crear una invitación por persona, con rol Administrador/Adulto para quien corresponda
y Chico para los hijos; compartir su enlace o QR. Cada invitado entra con su propia
cuenta. Si usan el mismo dispositivo, **Familia → Agregar miembro** crea perfiles
locales. Si aún aparece Crear mi casa, primero falta vincular una casa a la nube.
