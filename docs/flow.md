# AgroClima — flujo móvil (Diseño)

Usuario: caficultor pequeño (1–5 manzanas) en Santa Ana / Ahuachapán / Chalatenango. Usa teléfono y WhatsApp, y lee con dificultad. Sin cuentas, sin mapas.
**Todos los números y valores son de ejemplo, marcados «ejemplo». No son diagnósticos ni datos de riesgo reales.**

Mockups (390×844): `01_foto.png`, `02a_resultado_roya.png`, `02a2_resultado_roya_probable.png`, `02b_resultado_sana.png`, `02c_resultado_otro.png`, `02d_resultado_repetir.png`, `02e_resultado_no_seguro.png`, `03_riesgo.png`, `04_plan.png`, `05_escuchar_compartir.png`. Flujo completo: `agroclima_flow_combined.png`.

## Siempre visible (abajo, en todas las pantallas)
- Botón «▶ Escuchar»: ancho completo, alto 56 px. Solo se llama al servidor al tocarlo. Mientras prepara el audio: «Preparando audio…» y un giro. Mientras suena: «❚❚ Pausar» y una barra delgada. Al terminar: «▶ Escuchar otra vez».
- El orden de lectura es el resultado, luego el plan, luego el riesgo de la semana, y al final «Es una orientación, no un diagnóstico.»
- Si no hay clave, si el audio falla, o si el teléfono no puede reproducirlo, se usa la voz del teléfono (es-US, luego es-MX, luego es-ES). Si tampoco hay esa voz, aparece «No pudimos leer en voz alta.»

## 1/5 Foto
- Título: «Tome una foto de una hoja de café.»
- Ayuda: «Una sola hoja, de cerca, con buena luz.»
- Botón principal: «Tomar foto de la hoja» (abre la cámara, `capture="environment"`)
- Botón secundario: «Subir foto»
- Pregunta: «¿Dónde está su finca?» y selector de municipio (Santa Ana, Ahuachapán, Chalatenango, …)
- Botón: «Usar mi ubicación» (pide permiso una sola vez; si se niega: «No pudimos usar su ubicación. Elija su municipio.»)
- Botón desactivado hasta tener foto y lugar: «Revisar hoja»

## 2/5 Resultado (estados; cada uno con su mockup)

### Reglas de confianza (ML, provisionales)
1. **Repetir foto siempre gana**: si el modelo pide repetir, se muestra Repetir foto sin importar la confianza.
2. Confianza **≥ 0.80**: **Seguro**. El estado se muestra tal cual.
3. Confianza **0.60–0.79**: **Probable**. Es el mismo estado, con la etiqueta «Probable · confirme con un agrónomo» (en el mockup: «Probable · NN %» y debajo «Confirme con un agrónomo»). El botón principal pasa a ser «Compartir con mi agrónomo».
4. Confianza **< 0.60**: **No estamos seguros** (sin plan).
5. **Parece sana necesita ≥ 0.85**. Si es menor: No estamos seguros (sin plan).

El % se muestra pequeño junto a la palabra.

**a) Roya · Seguro** (`02a`): «Parece roya» · «Seguro · NN %». Tarjeta: «Esto es una orientación, no un diagnóstico. Confirme con un agrónomo.» Botones: «Ver riesgo de 7 días», «Tomar otra foto».

**a2) Roya · Probable** (`02a2`): «Parece roya» · «Probable · NN %» · «Confirme con un agrónomo». La misma tarjeta. Botones: «Compartir con mi agrónomo» (principal), «Ver riesgo de 7 días».

**b) Sana** (solo con ≥ 0.85, `02b`): «Parece sana» · «Seguro · NN %». «No vemos señales de roya en esta hoja. Revise otras plantas cada semana.» Tarjeta: «Esto es una orientación, no un diagnóstico.»

**c) Otro problema** (`02c`): «No parece roya, pero la hoja tiene algo. Esta app solo revisa roya.» Botones: «Compartir con mi agrónomo», «Ver riesgo de 7 días». Sin plan contra la roya.

**d) Repetir foto** (`02d`): título «Repetir foto», la razón y una tarjeta «Consejo». `retake_reason`: si falta o es desconocida, se usa `otra`.
| retake_reason | Razón | Consejo |
|---|---|---|
| borrosa | «La foto está borrosa.» | «Sostenga el teléfono quieto con las dos manos. Toque la hoja en la pantalla para enfocar.» |
| no_hoja | «No vemos una hoja de café.» | «Ponga una sola hoja de café en el centro, sobre su mano o un papel.» |
| lejos | «La hoja está muy lejos.» | «Acérquese a un palmo de la hoja. Que la hoja llene la pantalla.» |
| otra | «No pudimos revisar esta foto.» | «Tome la foto de día, con buena luz y sin sol directo. Una sola hoja, de cerca.» |
- Botón: «Tome otra foto»

**e) No estamos seguros** (`02e`): «No seguro · NN %». «No le damos un plan para no aconsejarle mal. Envíe el resultado a su agrónomo o cooperativa.» Botones: «Compartir con mi agrónomo», «Tome otra foto». Tarjeta gris «Contactos PROCAFE / CENTA: pendiente de verificar». **Sin plan.**

### «Compartir con mi agrónomo» (antes «Consulte a un agrónomo»)
- Acción principal: abre WhatsApp (`https://wa.me/?text=`) con el resultado, la fecha de la foto y el departamento, para que el caficultor lo reenvíe a su agrónomo o cooperativa. Ejemplo de texto: «AgroClima: Parece roya (Probable). Foto del 12/10/2026. Departamento: Santa Ana. Es una orientación, no un diagnóstico.» (ejemplo)
- La foto no se adjunta automáticamente, porque `wa.me` solo envía texto. Ver la pregunta abierta.
- Contactos PROCAFE/CENTA: se muestran solo cuando el Data Engineer los verifique. Mientras tanto aparece el marcador «pendiente de verificar».

## 3/5 Riesgo 7 días
- Título: «Riesgo de roya esta semana» · «<Municipio> · toque un día»
- 7 fichas de día. Cada una lleva color, ícono y palabra: ▲ Alto (rojo), ● Medio (ámbar), ▼ Bajo (verde). El color nunca va solo.
- Al tocar un día se abre una tarjeta «<Día>: <Nivel>» con la razón en frases cortas sobre la humedad, la lluvia y la temperatura.
- Enlace: «Fuente: <regla publicada> ↗» (cita del Data Engineer) · «Pronóstico: Open-Meteo.»
- Botón: «Ver mi plan»

## 4/5 Plan
- Tarjetas: **Qué** · **Cuánto** · **Cuándo** (el contenido viene de las reglas citadas; los mockups usan texto de ejemplo)
- Tarjeta verde: «Próximo día seco para fumigar» con «☀ <día>, en la mañana»
- «Use guantes y mascarilla. Lea la etiqueta.»
- Bajo el plan, cerrado al inicio: «¿Tiene una pregunta?». Chips «¿Por qué el jueves es Alto?», «¿Qué significa Probable?», «¿Cuándo fumigar?». Campo con «Escriba su pregunta». El micrófono solo si el teléfono tiene SpeechRecognition. Cada respuesta trae un ▶ chico y «Basado en el pronóstico y la foto de esta pantalla». Si no puede responder: «No puedo responder eso con seguridad. Consulte con su agrónomo.» y debajo «Compartir con mi agrónomo». Si hay muchas preguntas: «Ha hecho muchas preguntas seguidas. Intente en unos minutos.»
- Botón: «Escuchar o compartir»
- Solo aparece después de los resultados a) Roya o b) Sana (para b, un plan preventivo).

## 5/5 Escuchar / Compartir
- «Su resumen» y una tarjeta con 3–4 frases cortas
- «▶ Escuchar» (botón de 56 px, ancho completo). Sin audio del servidor, usa la voz del teléfono. Si no hay ninguna, «No pudimos leer en voz alta.»
- «Compartir por WhatsApp» (`https://wa.me/?text=` con el resumen, la advertencia y el enlace)
- «Empezar de nuevo»

## Estados generales
- **Cargando** (diagnóstico): «Revisando su hoja…» con un indicador animado y el botón Escuchar activo. Si pasan más de 10 s: «Esto tarda un poco. Espere, por favor.»
- **Cargando** (riesgo): fichas vacías en gris con la palabra «Cargando».
- **Error**: «Algo salió mal. Intente otra vez.» y el botón «Intentar otra vez». Nunca mostrar códigos técnicos.
- **Sin señal**: «Sin señal. Su foto está guardada en este teléfono. Toque "Intentar otra vez" cuando tenga señal.» (no es modo offline; solo conserva la foto en memoria).
- **Pronóstico no disponible**: «No hay pronóstico ahora. El resultado de la hoja sigue siendo válido.»

## Accesibilidad
- Tamaño de letra: cuerpo ≥ 18 px, títulos ≥ 24 px y veredicto de 28–32 px. Excepción: la palabra dentro de cada ficha de día mide 12–14 px en negrita para que quepan 7 fichas en 390 px. La tarjeta del día muestra la misma información a 18–20 px y Escuchar la lee.
- Áreas táctiles ≥ 48 px. Botones de 56–76 px. Fichas de día de 47×110 px.
- Contraste WCAG AA: blanco sobre #1E5B2A, #8A1C14 sobre #FDE2E1, #6B4B00 sobre #FFF1C2 y #1E5B2A sobre #DDF2E0 (todos ≥ 4.5:1).
- Íconos siempre acompañados de una palabra. Frases cortas, en «usted».
- Etiquetas `aria-label` en las fichas («Lunes, riesgo alto»). El veredicto se anuncia con `aria-live`.
- TTS: al tocar «▶ Escuchar», audio del servidor si hay clave; si no, voz del teléfono (es-US → es-MX → es-ES). Si ambas fallan, «No pudimos leer en voz alta.» El botón sigue visible.

## Risk strip — missing data states (added Oct 11)
- **Sin datos (per day):** grey chip, "–" icon, word "Sin datos" (never color alone). Day card: "No hay pronóstico completo para este día." Never shows a level.
- **Pronóstico no disponible (whole strip):** replaces the strip on any fetch failure, empty reply, or non-America/El_Salvador timezone. Text: "No pudimos obtener el pronóstico. Revise su señal e intente de nuevo." Button: "Intentar de nuevo". Diagnosis and "Compartir con mi agrónomo" stay usable.
