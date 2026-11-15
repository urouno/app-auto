# Auto Mantenimiento

Aplicación web para administrar el mantenimiento del automóvil. Funciona en el navegador (celular o computadora), sin servidor ni cuentas: los datos se guardan en el propio dispositivo.

## Funciones

- **Presión de llantas** — registro de lecturas por llanta, diagrama con la última medición comparada contra la presión recomendada (correcta ±2 psi, crítica a más de ±5 psi), historial y aviso cuando pasan más de 30 días sin medir.
- **Bitácora de servicios** — servicios realizados (fecha, kilometraje, costo, taller, notas) y programados por fecha y/o kilometraje; un servicio programado se completa con un toque y pasa al historial. Muestra el gasto del año.
- **Consumibles** — intervalos por kilometraje y/o meses (lo que ocurra primero), cálculo del próximo reemplazo, barra de vida útil y estado: *al día*, *próximo* (≤ 1,000 km o ≤ 30 días) o *vencido*. Al registrar un reemplazo se reinicia el contador y queda asentado en la bitácora.
- **Resumen** — todos los pendientes en una sola pantalla.
- **Varios vehículos**, respaldo con exportar/importar JSON, modo oscuro y uso sin conexión (PWA instalable).

Al dar de alta un vehículo se cargan consumibles comunes con intervalos típicos; ajústalos según el manual del fabricante.

## Uso local

No requiere instalación de dependencias:

```bash
npm start
```

y abre <http://localhost:8080>. Pruebas de la lógica de cálculo:

```bash
npm test
```

## Publicación

El flujo `.github/workflows/pages.yml` ejecuta las pruebas y despliega a GitHub Pages en cada push a `main`. Requiere activar una vez **Settings → Pages → Source: GitHub Actions** en el repositorio.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `logic.js` | Cálculos puros: vencimientos, estado de llantas, alertas |
| `app.js` | Estado (localStorage), formularios y vistas |
| `styles.css` | Estilos, tema claro/oscuro |
| `sw.js` | Service worker para uso sin conexión |
| `tests/` | Pruebas con `node --test` |
