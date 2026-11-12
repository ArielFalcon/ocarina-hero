# Objetivo del proyecto — Ocarina Tabs

Documento de producto. Recoge qué queremos construir, con qué criterio de fidelidad y
por qué se tomaron las decisiones técnicas que se tomaron. El detalle de ejecución y el
historial de cambios están en `odd/tasks/ocarina-tabs.md`.

## 1. Qué es

Una web que convierte una canción en una **secuencia de botones para la ocarina del
remake de *The Legend of Zelda: Ocarina of Time*** (Nintendo Switch 2, 5 de noviembre de
2026), y que sirve para aprenderla:

- Muestra el tab de la canción.
- Lo reproduce con el sonido de la ocarina.
- Permite practicar tocando las teclas o el pad mientras el tab sigue visible.

No es un juego ni un emulador. Es un **tutorial y un transcriptor**: entra una canción,
sale cómo tocarla en el juego.

## 2. Referencia de fidelidad

La referencia es el **remake de 2026**, no el original de N64. Se usa el original solo
cuando el sistema de música es idéntico y su documentación es mejor.

Hechos verificados sobre el remake:

- La ocarina mantiene **cinco notas** y es **monofónica**.
- Los botones en Switch 2 son **L, R, A, Y, X**. Existe un ajuste para intercambiar el
  esquema de botones; el segundo esquema todavía no está documentado.
- Hay **12 canciones enseñadas** más la *Scarecrow's Song* (8 notas compuestas por el
  jugador).
- El juego añade entrada por micrófono (cantar o tocar un instrumento). **Ese camino está
  fuera del alcance de este proyecto por decisión del producto.**

## 3. El instrumento (modelo interno)

| Nota escrita | Suena | Botón | N64 |
| --- | --- | --- | --- |
| D4 | D5 | L | A |
| F4 | F5 | R | C-abajo |
| A4 | A5 | A | C-derecha |
| B4 | B5 | Y | C-izquierda |
| D5 | D6 | X | C-arriba |

Dos matices que cambiaron el diseño:

1. **Suena una octava por encima de la notación habitual.** Las nuevas grabaciones
   sitúan la nota escrita A4 en aproximadamente 894 Hz y B4 en 1001 Hz. El modelo
   conserva los nombres escritos para que los tabs sean legibles y desplaza la
   altura real al reproducir.
2. **La afinación es por nota, no global.** Calibración provisional sobre la nueva grabación
   de notas aisladas: D +23.92 ¢, F +4.31 ¢, A +27.38 ¢, B +23.59 ¢, D5 +23.31 ¢.
   Las mediciones y sus límites están en [`calibration.md`](calibration.md).
   Un único offset no describe la afinación de las cinco notas.

### Bends

El mando permite alterar la nota:

- **Stick arriba/abajo**: continuo, hasta un tono completo (±2 semitonos).
- **D-pad arriba/abajo**: medio tono (±1).

Con eso, el instrumento cubre nominalmente **C5 a E6**, 17 pasos cromáticos.
Se conservan las 25 combinaciones botón+bend porque sus frecuencias medidas no
son equivalentes exactos. En X, el D-pad produce aproximadamente +114/−119 cents;
el modelo incluye esa diferencia. Los extremos del stick siguen siendo una
aproximación de ±2 semitonos, sin atribuir un offset fijo a cada gesto.

## 4. El producto

Funciones que debe tener y estado:

- **Cargar canción**: MIDI y audio (MP3, WAV, M4A, OGG…). Hecho.
- **Ver el tab sin reproducir**: pulsar una canción solo muestra las notas. Hecho.
- **Reproducir / parar**: botón que alterna y no cierra el tab. Hecho.
- **Practicar con el tab visible**: tocar las teclas no borra la canción. Hecho.
- **Bends como botones**: `D-pad ↑/↓` y `Stick ↑/↓`, momentáneos y multi-touch. Hecho.
- **Afinación ajustable**: slider con `−`, `+` y reset a 0, más calibración desde una
  grabación. Hecho.
- **Canciones de ejemplo**: Lullaby in-game (con su frase de resolución), Ode to Joy,
  Happy Birthday, Twinkle, In the End, Never Gonna (estribillo), Littleroot (inicio).

## 5. Pipeline interno

```
MIDI  ─┐
       ├─→ extraer ─→ simplificar ─→ refluir ─→ proyectar ─→ tab + audio
audio ─┘
```

1. **Extraer**
   - MIDI: se elige la pista melódica (descarta batería por canal 9, el bajo por registro
     y las pistas con poca monofonía) y se toma la nota superior de cada ataque.
   - Audio: se segmenta por **cambio de altura**, no por energía. La ocarina toca ligado,
     así que no hay ataques que detectar: la frontera de nota es donde el pitch se mueve y
     se mantiene.
2. **Simplificar** (`simplify`): elimina adornos que el secuenciador escribió como notas
   reales. Tres reglas por forma, nunca por canción:
   - dos notas cortas contiguas que ascienden a una larga: ligado, se descartan;
   - un run corto que alterna dos alturas: trino, se colapsa a una nota;
   - un run corto de tres o más alturas distintas: pasaje real, se respeta.
3. **Refluir** (`reflow`): sostiene cada nota hasta la siguiente dejando solo 0.06 beats
   de articulación. Sin esto quedaban huecos y sonaba a máquina.
4. **Proyectar** (`project`): Viterbi sobre las 25 combinaciones botón+bend.
   - La melodía se transporta **entera**, por octavas, y se coloca en el registro real.
     Plegar nota por nota rompía el contorno (G4..G5 salía en octavas alternas).
   - Se prueban doce colocaciones alrededor del centro del registro.
   - Coste: altura (dominante), contorno, y un pequeño coste por usar y cambiar de bend.
   - Se valoran las frecuencias calibradas de las 25 combinaciones, sin deduplicar
     por MIDI nominal: dos combinaciones pueden tener distinta afinación.
5. **Renderizar**: tab agrupada por silencios, con iconos de botón + joystick/D-pad y dirección para los bends, y audio con el modelo de
   voz compartido.

## 6. Decisiones y por qué

| Decisión | Motivo |
| --- | --- |
| Sin micrófono | Pedido explícito: el objetivo es transformar canciones a botones. |
| Sin IA en runtime | Coste, latencia, no determinismo. Todo es DSP y programación dinámica. |
| MIDI primero, audio después | El MIDI trae las notas exactas; el audio necesita detección y es monofónico. |
| Afinación por nota | La medición mostró que el instrumento no está afinado de forma uniforme. |
| Octava medida, no supuesta | La grabación del juego demostró que suena una octava arriba. |
| Segmentación por pitch en audio | La energía no detecta ataques en una interpretación ligada. |
| Conservar combinaciones con distinta afinación | Evita descartar una combinación más fiel por compartir MIDI nominal. |
| D-pad instantáneo, stick deslizante | Así se comporta el mando; la curva exponencial sonaba a sintetizador. |

## 7. Límites conocidos

- **Monofónico**: el instrumento no puede tocar acordes. La armonía no se representa.
- **Melodías que no caben**: con bends el rango es C5–E6 (17 semitonos). Una melodía más
  amplia se comprime y pierde contorno.
- **Audio completo**: una mezcla con batería, bajo y voz no se puede transcribir sin
  separar instrumentos. Solo se acepta melodía clara.
- **30 segundos** de audio por transcripción, porque corre en el hilo principal.
- **Fuente**: el pipeline es exacto respecto a su entrada. No corrige un MIDI mal
  transcrito ni una melodía mal elegida.
- **Legal**: proyecto fan, sin assets de Nintendo. Las melodías de terceros tienen
  copyright; no se monetiza ni se alojan grabaciones.

## 8. Estructura

```
src/core/        modelo de notas, proyección, tab, transcripción, calibración
src/audio/       motor Web Audio y modelo de voz compartido
src/ui/          pad, teclado, controles y render del tab
src/core/songs/  canciones de ejemplo (MIDI exportado)
scripts/         medición, calibración, corpus y auditoría de MIDI
odd/             documento de la feature e historial de decisiones
out/             artefactos locales de análisis (no forma parte del producto)
```

## 9. Cómo ejecutar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

Herramientas de verificación:

- `scripts/measure.ts <demo>`: renderiza a WAV y mide pitch por nota, silencios y pico.
- `scripts/calibrate.ts <audio>`: mide el offset en cents de una grabación real.
- `scripts/corpus.ts check`: compara la extracción contra el corpus de referencia.
- `scripts/inspect.ts <mid>` / `bars.ts`: audita pistas y estructura de un MIDI.

## 10. Estado

**Funciona**: instrumento, bends, tabs, reproducción, práctica con tab persistente, carga
de MIDI, carga de audio monofónico, medición y calibración.

**Pendiente**:
- Canciones de terceros verificadas. Never Gonna, Littleroot y Axel F se cortaron de MIDIs
  y no están confirmadas contra la grabación original; Axel F se retiró porque su fuente
  no contenía el riff.
- Aceptar mezclas completas exigiría separación de stems, que hoy está fuera de alcance.
- Interfaz: hoy es funcional, no está diseñada.
