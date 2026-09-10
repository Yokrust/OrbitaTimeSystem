# ORBTIME

Caja por tiempo para el anticafé Órbita. Registras quién entra, el reloj corre
solo, y al final del día sale un reporte.

**Estado: prototipo v0.1 para macOS.** La app de iPhone y la sincronización en
tiempo real vienen después (ver *Fase 2*).

---

## Qué hace

- **Cuentas de grupo.** Escribes los nombres y se abre "Cuenta 1", "Cuenta 2"…
  numeradas solas. La gente se va agregando conforme llega, y cada quien corre
  su propio reloj desde el momento en que entró. Al cobrar se suman todos.
- **Tiempo real.** Cronómetro por persona y total de la cuenta, al segundo.
- **Tres paquetes y tres formas de pagar.** Cada persona paga por tiempo, con
  pase de día o con pase all access, y se puede cambiar en cualquier momento.
- **Horario del negocio.** La barra dice si está abierto y a qué hora cierra, y
  avisa a 30 y a 15 minutos del cierre si todavía queda gente adentro.
- **Descuentos.** El 10% de estudiante se marca al cobrar, persona por persona
  o toda la mesa de un golpe. La happy hour se aplica sola.
- **Alarmas.** Notificación de macOS cada cierto tiempo (cada hora por
  defecto) por cada persona que paga por tiempo, con lo que lleva acumulado.
- **Segundo plano.** Cerrar la ventana esconde la app en la barra de menús: los
  relojes siguen y las alarmas siguen llegando. Desde ahí se exporta o se sale.
- **Reporte del día.** Un CSV y un JSON en `Documentos/ORBTIME/`, con el
  resumen, el desglose por paquete, modalidad, descuento y método de pago, y
  una fila por persona. Sale por el botón *Cerrar día*, por el menú de la
  barra, y también solo: cerrar la app con ⌘Q aplaza la salida hasta dejar el
  reporte en disco.

Nada de esto depende de internet: todo se guarda en disco en cada cambio.

---

## Precios

|        | Por hora | Día  | All access | All access en happy hour |
| ------ | -------- | ---- | ---------- | ------------------------ |
| Black  | $59      | $180 | $200       | —                        |
| Blue   | $75      | $240 | $280       | —                        |
| Gold   | $90      | $290 | $330       | **$240**                 |

Todo se edita en **Ajustes** y queda guardado.

### Horario

| Día              | Abre  | Cierra |
| ---------------- | ----- | ------ |
| Lunes a viernes  | 8:30  | 21:30  |
| Sábado           | 10:00 | 21:00  |
| Domingo          | 12:00 | 21:00  |

### Cómo se cobra

- **Por tiempo:** se cobra la hora empezada. 40 minutos de Black son $59; 1h 10m
  son $118. El bloque está en una sola constante (`BLOQUE_MINUTOS` en
  `src/lib/cobro.ts`): ponerlo en 30 cobraría por medias horas, en 15 por
  cuartos, en 1 al minuto.
- **Día** y **all access:** precio fijo, sin importar cuánto se queden.

### Descuentos

- **Estudiante, 10%.** Siempre disponible. Se marca por persona al cobrar.
- **Happy hour.** Solo el all access de Gold, y solo dentro de la ventana:
  lunes a viernes de 8:30 a 11:00, más viernes y sábado de 10:00 a 12:00 (el
  viernes tiene las dos). Baja de $330 a $240 y se aplica solo.

**Los descuentos nunca se acumulan.** Si alguien entró en happy hour, manda ese
precio y el 10% ya no se aplica encima. Lo que decide es la hora de **entrada**,
no la hora en que el cajero cobra: el pase se compró al entrar.

---

## Correr el proyecto

Node y Rust ya están instalados en esta máquina (Rust 1.98).

```bash
npm install
npm run app
```

La primera compilación de Rust tarda varios minutos; las siguientes son rápidas.

Si `cargo` no aparece en alguna terminal, es que falta el PATH:

```bash
source "$HOME/.cargo/env"
```

Para generar el `.app` y el `.dmg` instalables:

```bash
npm run app:build
```

### Sin Rust

La interfaz sola corre en el navegador, con los datos en `localStorage` en vez
de en disco. Sirve para trabajar el diseño, pero sin barra de menús ni
notificaciones nativas:

```bash
npm run dev
```

### Pruebas

La lógica de cobro maneja dinero, así que está cubierta:

```bash
npm test
```

---

## Cómo está armado

```
src/
  tipos.ts              modelo de dominio (Cuenta, Persona, Paquete)
  lib/
    tiempo.ts           duraciones, formatos, corregir hora a mano
    horario.ts          apertura, cierre y ventanas de happy hour
    cobro.ts            las reglas de precio         ← el corazón
    alarmas.ts          qué avisar y cuándo
    almacen.ts          guardar y cargar el día
    exportar.ts         reporte CSV / JSON
    nube.ts             enganche con Supabase (fase 2, sin conectar)
  estado/
    acciones.ts         reducer: todos los cambios pasan por aquí
    useCaja.ts          carga, autoguardado, ciclo de alarmas
  componentes/          interfaz
src-tauri/src/lib.rs    barra de menús, cierre a segundo plano, latido
supabase/schema.sql     tablas para la fase 2
```

**La regla que sostiene todo:** nunca se guarda un contador que avanza, solo
marcas de tiempo. El tiempo transcurrido siempre se calcula restando. Por eso
el conteo sigue bien aunque la Mac se duerma, se cierre la ventana o se
reinicie la app a media tarde.

El proceso de Rust manda un *latido* cada 30 segundos. macOS congela los
temporizadores de una ventana escondida; el latido despierta a la interfaz para
que revise si toca alarma. Y si aun así se pierden avisos, al volver se calcula
cuáles se saltaron y se manda **uno solo**, no la ristra completa.

Ese mismo proceso intercepta la salida: con ⌘Q, Rust aplaza el cierre, le pide
a la interfaz que exporte, y la deja terminar. Si la interfaz no contesta en 5
segundos, sale de todos modos — más vale cerrar sin reporte que quedarse
colgado, y el estado del día ya está guardado en disco de cualquier forma.

---

## Fase 2 — iPhone y sincronización

El plan que ya está preparado:

1. `supabase/schema.sql` crea las tablas (espejo del modelo local), las
   políticas de RLS y las suscripciones de realtime. Se pega en el SQL Editor
   de Supabase y listo.
2. `.env.example` → `.env` con la URL y la anon key del proyecto.
3. `src/lib/nube.ts` ya trae el cliente y el mapeo entre las filas y el modelo.
   Falta conectarlo al reducer.
4. `npm run tauri ios init` para la app de iPhone, con el mismo frontend.

**Decisión pendiente**, anotada al final de `nube.ts`: si la Mac y el iPhone
tocan la misma cuenta al mismo tiempo, gana el último que escribe. Lo más
sensato para arrancar es que solo la Mac escriba y el iPhone sea de consulta.

---

## Cosas que faltan

- Firmar y notarizar el `.app` (si no, macOS pide permiso al abrirlo).
- Consumos aparte del tiempo (bebidas, comida) sumados a la cuenta.
- Pausar el reloj de una persona sin cerrarle la cuenta.
- Avisar justo antes de que alguien cruce a la siguiente hora, para poder
  ofrecerle el pase de día antes de que le salga más caro.
- Historial de días anteriores dentro de la app (hoy solo quedan los archivos
  exportados).
