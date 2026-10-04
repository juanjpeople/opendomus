# Precios de OpenDomus: cuentas claras

> Borrador (octubre de 2026). Es la base de la página pública "Cuentas claras". Los precios se deciden cuando lleguen los cobros; hasta entonces, la nube está en beta por invitación y es gratis.

## La idea

- **OpenDomus es gratis en tu dispositivo, para siempre.** Sin cuenta, sin nube, sin pagar nada. Todas las funciones.
- **La nube es opcional.** Sirve para compartir la casa con tu familia y tenerla en todos sus dispositivos, cifrada de extremo a extremo: ni nosotros podemos leerla.
- **La nube cuesta lo que cuesta, más un margen justo.** La familia típica entra en el plan básico. Preferimos ganar poco con muchas familias contentas que mucho con pocas atrapadas.

## Lo que nos cuesta una casa en la nube

Con los precios de Cloudflare de octubre de 2026, para una familia típica:
- 4 personas, 5 dispositivos.
- Unos 100 cambios por día y 100 fotos de recetas.
- Para tener margen, se cuenta el **triple** de uso.

| Pieza | Uso por casa y por mes | Precio | Costo por casa y por mes |
|---|---|---|---|
| Pedidos a la API (Workers) | ~30.000 | US$0,30 por millón | ~US$0,009 |
| Registro de cambios (Durable Objects) | ~25.000 pedidos | US$0,15 por millón | ~US$0,004 |
| Datos de sincronización | ~0,1 GB (crece ~15 MB por año) | US$0,20 por GB-mes | ~US$0,02 |
| Fotos cifradas (R2) | ~0,5 GB | US$0,015 por GB-mes, sin costo de salida | ~US$0,008 |
| CPU, base de cuentas y escrituras | mínimo | — | menos de US$0,005 |
| **Total** | | | **~US$0,05 por mes (~US$0,60 por año)** |

**Costos fijos**:
- El plan pago de Cloudflare, US$5 por mes, cuando se supera el gratuito (alcanza para unas 300 casas).
- El dominio.
- El servicio de emails (gratis hasta 3.000 por mes).
- El contador y los impuestos.
- Lo más importante: el tiempo de mantener, dar soporte y mejorar OpenDomus.

## Lo que se lleva el cobro

| Cómo se cobra | Comisión | Para qué conviene |
|---|---|---|
| **Paddle** (internacional) | 5% + US$0,50 por cobro. Cobra y paga los impuestos de cada país (*merchant of record*). | Pagos en dólares desde cualquier país. |
| **Lemon Squeezy** (internacional) | 5% + US$0,50, más 1,5% internacional y 0,5% por suscripción, más el costo del retiro. | Alternativa a Paddle. |
| **Mercado Pago** (Argentina) | Entre ~3% y ~8% según el plazo de acreditación, más IVA, **sin cargo fijo**. | Pagos en pesos, también mensuales. |

En dólares, el cargo fijo de US$0,50 pesa mucho en montos chicos: un cobro de US$1 pierde 55%; uno de US$12 anual, 9%. Por eso el pago anual es el más justo para los dos. En pesos, con Mercado Pago, el mensual no tiene ese problema.

## Propuesta de planes

| Plan | Qué incluye | Precio |
|---|---|---|
| **En tu dispositivo** | Todo, sin cuenta | **Gratis, para siempre** |
| **Autoalojada** (más adelante) | En tu propio servidor (Raspberry, NAS), código abierto | **Gratis** |
| **Nube Familia** | 1 casa, hasta 10 personas, dispositivos sin límite, 5 GB de fotos cifradas, historial completo | **US$15 por año**. En Argentina, el equivalente en pesos por paridad de poder adquisitivo, también mensual. |
| Espacio extra | +25 GB de fotos, solo si alguien lo necesita | Al costo más un margen chico (~US$5 por año) |
| Solidario | Para quien hoy no puede pagar | Gratis, a pedido |

**Cuentas de US$15 por año, pagando por Paddle**:
- La comisión se lleva ~US$1,25.
- La infraestructura, con margen, ~US$0,60.
- Quedan **~US$13 por casa y por año** para mantener, dar soporte y mejorar.
- Es menos de la mitad de lo que cobran apps parecidas para la familia, sin publicidad y sin vender nada de nadie (además, no podríamos: los datos están cifrados).

## Compromisos

- **Por casa, no por persona.** Invitar a tu familia nunca cuesta más.
- **Las mismas funciones en todos los planes.** La seguridad y la privacidad nunca se cobran aparte.
- **Tus datos nunca quedan de rehenes.** Si la nube vence, queda en pausa por 90 días: seguís viendo y exportando todo, pero no se suben cambios nuevos. Tu copia en el dispositivo sigue funcionando completa.
- **Precio congelado** para quien ya paga. Los que entran en la beta mantienen el precio de fundador.
- **Se cancela en un clic.** Sin preguntas ni trampas.
- **Precio por región**, según el poder adquisitivo.
- **Cuentas públicas.** Esta página se actualiza con los costos reales.

## Cómo funciona por dentro

Una casa en la nube necesita una **licencia**:
- Durante la beta, las emite Juan a mano (`npm run admin -- licencia nueva`).
- Cuando lleguen los cobros, las va a emitir el pago, sin intervención de nadie.
- Una licencia habilita **una casa**. Los invitados entran por link, sin licencia.
- Una casa se puede poner en pausa, por ejemplo si vence el plan: en pausa se baja todo y no se sube nada nuevo.

Fuentes de precios (octubre de 2026): [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Paddle](https://dodopayments.com/blogs/paddle-fees-explained), [Lemon Squeezy](https://learnwithhasan.com/payment-gateways/lemonsqueezy/), [Mercado Pago](https://www.iprofesional.com/tecnologia/386153-mercado-pago-que-debes-saber-sobre-comisiones-plazos-y-montos).
