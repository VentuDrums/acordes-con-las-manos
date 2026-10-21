# Plan: Acordes con las manos

Sinte de acompañamiento que se toca con gestos delante de la webcam. Proyecto para el máster de IA aplicada a la educación, abierto a cualquiera que quiera usarlo.

Estado: **fase 5 terminada**, pendiente de que la pruebe el usuario.

## 1. Objetivo y público

- Cualquier persona puede usarla desde un enlace, sin instalar nada (publicada en GitHub Pages).
- Se presenta como proyecto en el máster. Punto clave: la IA (MediaPipe) se ejecuta en el navegador y el vídeo no sale del ordenador.
- Tecnología de reconocimiento: **MediaPipe Hand Landmarker** (21 puntos por mano). Teachable Machine queda para otro proyecto.

## 2. Pantallas

1. **Pantalla de inicio**
   - Elegir el idioma: español o inglés.
   - Explicación breve y botón «Empezar». Ese clic también sirve para permitir el audio y la cámara.
2. **Pantalla de tocar**
   - Imagen de la cámara en espejo con la detección de las manos dibujada (izquierda y derecha en colores distintos).
   - El acorde que suena:
     - Modo escala: nombre y grado (por ejemplo, «Rem · ii»).
     - Modo personalizado: solo el nombre.
   - Botón para abrir la configuración.
3. **Panel de configuración (desplegable)**: todos los ajustes de los apartados 4 a 10, incluido el editor de patrones.

## 3. Gestos

Se reconocen con reglas sobre los puntos de la mano (qué dedos están estirados), sin entrenar ningún modelo.

| Gesto | Mano izquierda, modo escala | Mano derecha |
|---|---|---|
| ✊ Puño | Silencio | Fader de volumen (ver apartado 5) |
| ☝️ 1 dedo | I | Configurable |
| ✌️ 2 dedos | II | Configurable |
| 3 dedos (índice, corazón, anular) | III | Configurable |
| 4 dedos (pulgar dentro) | IV | Configurable |
| 🖐️ Mano abierta | V | Configurable |
| 🤙 Pulgar + meñique | VI | Configurable |
| 🤘 Índice + meñique | VII | Configurable |
| 👍 Pulgar | Sin asignar | Configurable |

- **Estabilidad:** un gesto solo cuenta cuando se mantiene unos instantes, para evitar parpadeos.
- **Mano izquierda fuera de cámara:** cuenta como puño (deja de sonar), con un margen de unos 0,3 s para que no corte si MediaPipe pierde la mano un momento.
- **Mano derecha fuera de cámara:** no cambia nada. Si estaba moviendo el fader, el volumen se queda donde estaba.
- **Mano izquierda y derecha:** se distinguen por su posición en la imagen. Habrá un ajuste por si salen al revés.

**Modo de calibración de gestos**

Sirve para afinar el reconocimiento con las manos reales de quien usa la app.

- Se abre desde la configuración.
- Eliges la mano (izquierda o derecha) y un gesto. Tras una cuenta atrás de 3 s, la app graba 3 s de medidas de la mano.
- Al terminar muestra cuántas veces ha reconocido bien el gesto y con qué lo ha confundido.
- Mientras se calibra no suena nada.
- Un botón descarga todas las medidas en un archivo (JSON) para ajustar los umbrales con esos datos.

## 4. Mano izquierda: elige el acorde

El modo se elige en la configuración.

- **Modo escala**
  - Tónica, escala (mayor, menores natural, armónica y melódica, y los modos) y tríadas o cuatriadas.
  - Cada gesto toca su grado, del I al VII.
- **Modo personalizado**
  - Para cada gesto (incluido 👍) se elige la nota y el tipo de acorde.
  - Un botón rellena la tabla con los acordes de la escala, como punto de partida.

## 5. Mano derecha: cómo suena

El modo se elige en la configuración. En cada modo, el valor que no controla la mano se fija en la configuración.

- **Modo inversión:** cada gesto elige estado fundamental, 1ª, 2ª o 3ª inversión, posición abierta u octava grave o aguda. Ajuste extra: el bajo sigue la inversión, sí o no.
- **Modo ritmo/acompañamiento:** cada gesto elige un patrón, por ejemplo bloque sostenido, negras, rasgueo pop, arpegios, bajo Alberti, vals, contratiempo o bossa.
- La tabla gesto → inversión o gesto → patrón se puede editar.
- **Fader de volumen (puño derecho, en los dos modos)**
  - Cierras el puño derecho y subes o bajas la mano para cambiar el volumen. Al abrir la mano, el volumen se queda fijo.
  - El movimiento es relativo: el volumen cambia según cuánto mueves la mano desde donde cerraste el puño, así no da saltos.
  - En pantalla se ve una barra de volumen mientras el fader está agarrado.
  - Por MIDI se envía como mensaje de control (CC7 o CC11, a elegir).

## 6. Tiempo y cambio de acorde

- **Tempo:** se ajusta a mano en la app. En los compases de subdivisión ternaria (3/8, 6/8, 9/8, 12/8) el pulso es la negra con puntillo.
- **Compás:** se elige en un selector: 2/4, 3/4, 4/4, 3/8, 6/8, 9/8 y 12/8. Cada compás guarda su propia tabla gesto → patrón.
- **Momento del cambio de acorde:** al instante, en el siguiente pulso o en el siguiente compás.
  - **Al instante:** al cambiar de acorde, lo que aún suena del acorde anterior (por ejemplo, un bajo largo) se corta y el acorde nuevo entra **en ese momento** con el resto de su duración, aunque sea un poco tarde (decisión del usuario tras probar la fase 3: antes sonaba el bajo del acorde anterior si el cambio no llegaba con antelación).
  - **En el siguiente pulso o compás:** el acorde nuevo espera a ese momento. Si el gesto llega un poco tarde (hasta una semicorchea después), cuenta para el pulso o compás que acaba de empezar y se corrige al momento.
  - El margen con el que se preparan las notas baja de 0,1 s a 0,05 s, para que haya menos cambios «tarde».
  - El puño (silencio) actúa siempre al momento.
- **Al cambiar de acorde dentro de un patrón:** se elige entre seguir a tempo con el acorde nuevo o reiniciar el patrón.
- **Modo libre o con metrónomo** (botón 🥁 de la cabecera, también en la configuración). Tras probar la fase 4, el usuario pidió poder volver al funcionamiento de la fase 3:
  - **Modo libre** (por defecto): sin click, sin pulso en pantalla, sin cuenta previa y el acorde cambia siempre al instante. El tempo sigue marcando los ritmos.
  - **Con metrónomo:** pulso en pantalla y los ajustes de cuándo entra el acorde, click y cuenta previa.
- **Metrónomo:**
  - Click audible activable, con volumen propio. El fader de volumen no le afecta.
  - Acento en la primera parte del compás. Un click por pulso.
  - **Cuenta previa opcional:** al empezar a tocar desde el silencio, suena un compás de clicks (aunque el metrónomo esté apagado) y el acorde entra en el compás siguiente.

## 7. Patrones de acompañamiento

Cada compás tiene sus propios patrones, y la tabla de la mano derecha solo muestra los que encajan con el compás elegido. Los patrones se definen por posiciones («bajo», «quinta», «acorde», «nota 1 del arpegio»…), no por notas fijas, así que funcionan con cualquier acorde e inversión.

Ejemplo con Do: bajo = Do2, quinta = Sol2, Ac = acorde Do3-Mi3-Sol3, arpegio = Do3 Mi3 Sol3 Do4 Mi4.

**Patrones de fábrica**

| Compás | Patrones |
|---|---|
| 2/4 | Bloque sostenido, negras, marcha/polka, habanera/tango, arpegio en semicorcheas |
| 3/4 | Bloque sostenido, negras, vals, arpegio en corcheas, bajo Alberti |
| 4/4 | Bloque sostenido, negras, balada, rasgueo pop, arpegio ascendente, arpegio que sube y baja, bajo Alberti, contratiempo (ska/reggae), rock en corcheas, charlestón, bossa nova (simplificada) |
| 3/8 | Bloque sostenido, vals rápido, arpegio |
| 6/8 | Bloque sostenido, pulsos, bajo-acorde-acorde, barcarola, balada arpegiada, arpegio ascendente |
| 9/8 | Bloque sostenido, pulsos, bajo-acorde-acorde, arpegio |
| 12/8 | Bloque sostenido, pulsos, balada años 50 (tresillos), balada arpegiada, shuffle/boogie |

El detalle de las notas de cada patrón está en el anexo A.

**Editor de patrones**

- **Fábrica y propios:** los patrones de fábrica no se modifican. Con «Duplicar y editar» o «Nuevo patrón» se crea un patrón propio, que aparece en la lista de su compás y se puede asignar a un gesto. Los patrones propios se guardan en el navegador.
- **Rejilla tipo step sequencer:**
  - Columnas: subdivisiones del compás. Semicorcheas en 2/4, 3/4 y 4/4; corcheas en 3/8, 6/8, 9/8 y 12/8.
  - Filas del acorde: Acorde completo, Power chord (fundamental + 5ª; añadida para poder duplicar «Rock en corcheas» sin cambiar su sonido) y Nota 1 a Nota 5 del arpegio.
  - Filas del bajo: Fundamental, 3ª y 5ª del acorde (siguen al acorde: en Dom la 3ª es Mi♭).
  - Filas de notas extra, contadas desde la fundamental: 2ª, 4ª, 6ª, 7ª menor y 7ª mayor (con Do: Re, Fa, La, Si♭ y Si). Cada una se puede poner en el registro grave (bajo) o en el medio (acorde).
- **Intensidad:** cada patrón elige si usa intensidades. Sin intensidades, todas las notas suenan igual. Con intensidades, cada casilla tiene tres niveles (suave, media o fuerte) que se cambian con clics sucesivos.
- **Duración:** un ajuste para todo el patrón, picado o ligado.
- **Escucha:** mientras editas, el patrón suena en bucle con el acorde que elijas (por ejemplo, Do, Dom o Do7).
- No se exportan ni se importan patrones en archivos.

## 8. Sonido

- **Instrumentos iniciales:** piano, pad y pluck.
- El código se organiza para añadir instrumentos nuevos fácilmente.
- Volumen general.

## 9. Salida MIDI (para FL Studio en Windows)

- Envía exactamente lo que sonaría en la app (acorde y bajo) para que lo toque un instrumento del DAW.
- Al activar el MIDI se puede silenciar el sonido de la app.
- Se elige el puerto MIDI de salida y el canal.
- Al parar o hacer el puño se envían los «note off» de todas las notas, para que no se queden notas colgadas.
- El tempo se ajusta a mano en los dos sitios. Sincronizar con el reloj MIDI del DAW queda para más adelante.
- **Requisitos que la app explicará:**
  - Navegador Chrome o Edge.
  - En Windows hay que instalar **loopMIDI** (gratis) y crear un puerto.
  - En FL Studio, en Options → MIDI settings, hay que activar ese puerto como entrada.

## 10. Idioma y notación

- La interfaz va en español e inglés. El idioma se elige en la pantalla de inicio y se puede cambiar desde la configuración.
- Nombres de las notas: Do-Re-Mi o C-D-E, a elegir.
- Los ajustes se guardan en el navegador.

## 11. Decisiones abiertas

- [x] **Puño de la mano derecha:** fader de volumen.
- [x] **Patrones y compás:** cada compás tiene sus patrones (apartado 7).
- [x] **Código ya escrito en la rama:** se empieza de cero. El código actual se borra al arrancar la fase 1.
- [x] **Editor de patrones:** rejilla con filas extra, intensidad opcional y duración picado/ligado (apartado 7).

## 12. Fases de desarrollo

Cada fase termina con algo que se puede probar y enseñar.

1. **Núcleo**
   - Pantalla de tocar con la cámara y las manos dibujadas.
   - La mano izquierda toca los grados de Do mayor con un pad.
   - Cambio de acorde al instante.
2. **Mano izquierda completa:** modo escala con todos sus ajustes, modo personalizado, panel de configuración (con el ajuste para intercambiar las manos) y modo de calibración de gestos.
3. **Mano derecha:** modos inversión y ritmo, con la tabla editable, y fader de volumen. Para que el modo ritmo se pueda probar ya, esta fase incluye los patrones de fábrica de 4/4 y el tempo ajustable.
4. **Tiempo:** el resto de compases y sus patrones, cuantización, metrónomo, cuenta previa y la opción de reiniciar el patrón al cambiar de acorde.
5. **Editor de patrones.**
6. **Sonidos:** piano, pad y pluck.
7. **MIDI:** salida a FL Studio a través de loopMIDI.
8. **Idiomas y pantalla de inicio:** español e inglés, y elección de notación.
9. **Publicación final:** prueba con usuarios reales y material para el máster.

La app se publica en GitHub Pages desde la fase 1, para poder probar cada fase desde la tablet (Xiaomi Pad 8 Pro, Android).

**Notas de la fase 1**
- Los umbrales del reconocimiento de dedos se ajustaron con unas 120 fotos de manos reales: acierta el 92 %. Las que fallan están de canto o del dorso; tocando con la palma de frente funciona mucho mejor.
- Los gestos 3 dedos, 4 dedos, 🤙 y 🤘 no tienen fotos reales de prueba: solo están comprobados con manos simuladas. Hay que verificarlos con manos de verdad.
**Notas de la fase 5**
- El editor se abre desde la configuración (sección de la mano derecha, «Editor de patrones»). Su selector de compás es el mismo compás de la app.
- Mientras el editor está abierto, los gestos no cambian lo que suena (para poder escuchar el patrón en bucle).
- Los patrones propios se guardan aparte de los ajustes. Al borrar uno, los gestos que lo tocaban pasan al bloque sostenido.
- Al duplicar un patrón de fábrica se conservan todas sus notas. Las duraciones pasan a «ligado» (cada nota hasta la siguiente de su fila) y las intensidades, a los tres niveles.

**Notas de la fase 4**
- Rejilla del reloj: semicorcheas en 2/4, 3/4 y 4/4; corcheas en 3/8, 6/8, 9/8 y 12/8. La lógica de cuándo entra un cambio está en `docs/js/music/timing.js`, con pruebas propias.
- Además de los cambios de acorde, elegir un patrón un poco tarde (hasta una semicorchea después de un paso) hace sonar al momento las notas de ese paso.
- En pantalla: puntos del pulso sobre la cámara, número grande durante la cuenta previa y el acorde en espera atenuado con «…».
- Botón de la cabecera para pasar del modo libre al modo con metrónomo y volver (en el móvil solo se ve el icono).

**Notas de la fase 3**
- Ritmos: un reloj de semicorcheas marca los pasos. Al cambiar de acorde o de patrón, el ritmo sigue cuadrado con el compás (comportamiento «seguir a tempo»; la opción de reiniciar llega en la fase 4).
- El bloque sostenido suena con el pad; los patrones rítmicos, con un piano de muestras grabadas (`docs/audio/piano`, 1,6 MB, ver CREDITOS.md). El sonido de teclado sintetizado del principio era demasiado flojo; queda solo como reserva mientras carga el piano. La elección de sonido llega en la fase 6.
- El modo de la mano derecha (inversión o ritmo) se cambia también desde el panel de debajo de la cámara; las tablas se editan en la configuración.
- Fader: medio alto de la imagen de recorrido va de volumen 0 a máximo. El volumen se guarda.
- En pantallas anchas la tabla de la mano derecha va debajo de la cámara para que todo quepa sin scroll en la tablet.

**Notas de la fase 2**
- Configuración en un panel desplegable (botón ⚙️). Los ajustes se guardan en el navegador.
- En el modo personalizado, el nombre de un acorde cuya nota está en la escala elegida se escribe como en esa tonalidad (Sol♯° en La menor armónica); si no está, con las grafías habituales (Si♭, Re♭, Fa♯…).
- Falsas detecciones vistas en la tablet (una oreja con auricular y, a veces, la ropa tomadas por una mano): la confirmación de MediaPipe (presencia) sube a 0,7 y se descartan las «manos» con la palma menor que el 4 % del alto de la imagen (una mano real a 1 m mide un 10 %; la oreja, un 2,6 %). En fotos de manos reales casi no se pierden detecciones.
- La calibración guarda, por cada fotograma, el gesto pedido, el reconocido, las medidas de los dedos y los 21 puntos de la mano.

**Notas de la fase 1 (continuación)**
- En la tablet (Xiaomi Pad 8 Pro) el modo GPU de MediaPipe detectaba peor las manos y el modo CPU va fluido, así que se usa CPU por defecto. `?delegate=GPU` al final de la dirección prueba la GPU.
- Primera prueba en la tablet: costaba encontrar la mano al principio. Ahora cada mano se busca en su zona de la imagen (el 65 % de cada lado, con solape en el centro) y con confianza mínima de 0,3 en vez de 0,5. En pruebas con manos pequeñas (lejos de la cámara) pasa de encontrar 11 de 36 manos a 25 de 36, sin falsas detecciones en fotos sin manos. Cuesta el doble de cálculo (dos detectores).

## 13. Cómo se comprueba

Regla: **ninguna fase se da por terminada sin pasar sus comprobaciones**. Lo que no se pueda comprobar automáticamente se dice claramente en el informe de la fase.

**Comprobaciones automáticas en cada fase** (las hace Claude antes de subir el código):

- **Tests de la lógica:** acordes, escalas, inversiones, patrones, cuantización, reconocimiento de gestos a partir de los puntos de la mano y mensajes MIDI.
- **Tests en un navegador real (Chromium):**
  - La página carga sin errores y se recorren las pantallas y los ajustes.
  - Los ajustes se guardan al recargar.
  - Pruebas con tamaño de móvil, de tablet y de ordenador.
- **Audio:**
  - Se comprueba que suenan las notas correctas en el momento correcto (registro de eventos).
  - Se comprueba que el audio generado no está en silencio. No se puede escuchar, pero sí medir.
- **Cámara:** se usa una cámara simulada. Si es posible, se usan también vídeos o fotos de manos reales como si fueran la cámara, para comprobar que MediaPipe reconoce los gestos.
- **MIDI:** se simula un puerto MIDI para verificar las notas, los «note off» y los mensajes de volumen que se envían.

**Comprobaciones que solo puede hacer el usuario** (cada fase incluye una lista corta de qué probar):

- Cómo responde a sus manos reales, con su luz y su cámara.
- Cómo suena de verdad.
- El MIDI en FL Studio con loopMIDI (desde un ordenador con Windows).
- Safari en iPad o iPhone: el navegador de pruebas es Chromium y no se puede probar el motor de Safari.

**Informe al terminar cada fase:** qué se ha hecho, qué se ha comprobado y cómo, qué queda pendiente de probar por el usuario y si se puede probar desde la tablet.

## Anexo A. Notas de los patrones (ejemplo con Do)

Leyenda: los números son las partes del compás e «y» es la corchea a contratiempo. En 3/8, 6/8, 9/8 y 12/8 se cuenta por corcheas. «Ac» es el acorde completo.

**2/4**
- Bloque sostenido: `1: Do2 + Ac (todo el compás)`
- Negras: `1: Do2+Ac | 2: Ac`
- Marcha / polka: `1: Do2 | y: Ac | 2: Sol2 | y: Ac`
- Habanera / tango: `1: Do2 (corchea con puntillo) | última semicorchea: Sol2 | 2: Ac | y: Ac`
- Arpegio en semicorcheas: `Do3 Mi3 Sol3 Do4 | Do3 Mi3 Sol3 Do4` (con Do2 en el 1)

**3/4**
- Bloque sostenido: `1: Do2 + Ac (todo el compás)`
- Negras: `1: Do2+Ac | 2: Ac | 3: Ac`
- Vals: `1: Do2 | 2: Ac | 3: Ac` (variante: el bajo alterna Do2 y Sol2 en cada compás)
- Arpegio en corcheas: `Do3 Mi3 | Sol3 Do4 | Sol3 Mi3` (con Do2 en el 1)
- Bajo Alberti: `Do3 Sol3 | Mi3 Sol3 | Do3 Sol3`

**4/4**
- Bloque sostenido: `1: Do2 + Ac (redonda)`
- Negras: `1: Do2+Ac | 2: Ac | 3: Do2+Ac | 4: Ac`
- Balada: acorde suave en cada corchea, `1: Do2 | 3: Sol2` en el bajo
- Rasgueo pop (↓ ↓↑ ↑↓↑): `1: Do2+Ac | 2: Ac | 2y: Ac | 3y: Ac | 4: Ac | 4y: Ac`
- Arpegio ascendente: `Do3 Mi3 | Sol3 Do4 | Do3 Mi3 | Sol3 Do4` (con Do2 en el 1)
- Arpegio que sube y baja: `Do3 Mi3 | Sol3 Do4 | Mi4 Do4 | Sol3 Mi3` (con Do2 en el 1)
- Bajo Alberti: `Do3 Sol3 | Mi3 Sol3 | Do3 Sol3 | Mi3 Sol3`
- Contratiempo (ska / reggae): `1: Do2 | 1y: Ac | 2y: Ac | 3: Sol2 | 3y: Ac | 4y: Ac`
- Rock en corcheas: Do2 + Do3-Sol3 (power chord) en las 8 corcheas
- Charlestón: `1: Do2+Ac | 2y: Ac | 3: Sol2`
- Bossa nova (simplificada en 1 compás): `1: Do2+Ac | 2y: Ac | 3: Sol2 | 4: Ac`

**3/8**
- Bloque sostenido: `1: Do2 + Ac (negra con puntillo)`
- Vals rápido: `1: Do2 | 2: Ac | 3: Ac`
- Arpegio: `Do3 Mi3 Sol3` (con Do2 en el 1)

**6/8**
- Bloque sostenido: `1: Do2 + Ac (todo el compás)`
- Pulsos: `1: Do2+Ac | 4: Ac`
- Bajo-acorde-acorde: `Do2 Ac Ac | Sol2 Ac Ac`
- Barcarola (negra-corchea): `1: Do2+Ac (negra) | 3: Ac | 4: Sol2+Ac (negra) | 6: Ac`
- Balada arpegiada: `Do2 Sol2 Do3 | Mi3 Do3 Sol2`
- Arpegio ascendente: `Do3 Mi3 Sol3 | Do4 Sol3 Mi3` (con Do2 en el 1)

**9/8**
- Bloque sostenido: `1: Do2 + Ac (todo el compás)`
- Pulsos: `1: Do2+Ac | 4: Ac | 7: Ac`
- Bajo-acorde-acorde: `Do2 Ac Ac | Sol2 Ac Ac | Do2 Ac Ac`
- Arpegio: `Do2 Sol2 Do3 | Mi3 Sol3 Do4 | Sol3 Mi3 Do3`

**12/8**
- Bloque sostenido: `1: Do2 + Ac (todo el compás)`
- Pulsos: `1: Do2+Ac | 4: Ac | 7: Sol2+Ac | 10: Ac`
- Balada años 50 (tresillos): acorde en las 12 corcheas, acentuando cada pulso, con `1: Do2 | 7: Sol2` en el bajo
- Balada arpegiada: `Do2 Sol2 Do3 | Mi3 Do3 Sol2 | Do2 Sol2 Do3 | Mi3 Do3 Sol2`
- Shuffle / boogie: bajo en negra-corchea `Do2·Mi2 | Sol2·La2 | Si♭2·La2 | Sol2·Mi2`, con acorde corto en los pulsos 2 y 4 (La y Si♭ son notas de paso típicas del boogie)
