# Vanth Labs — vanthlabs.org

Página principal de Vanth Labs. Sitio estático: HTML, CSS y JavaScript, sin build ni dependencias.
Se publica copiando el contenido de este repositorio a la raíz del sitio de vanthlabs.org.

## Estructura

| Ruta | Contenido |
|---|---|
| `/` | Español |
| `/es/` | Español (dirección canónica) |
| `/en/` | Inglés |
| `styles.css`, `main.js`, `lab.js` | Compartidos por las tres páginas |
| `fonts/` | Tipografías propias (licencias OFL en `fonts/OFL.txt`, Inter en `fonts/Inter-LICENSE.txt`) |
| `vendor/` | three.js r160 (MIT), solo se carga en la sección Laboratorio |
| `media/` | Grabación de Hannah (webm, mp4 y póster) |

No hace peticiones a servidores externos: fuentes y librerías van incluidas.
Si el servidor envía una Content-Security-Policy, debe permitir `'self'` para script, style, font y media.

Los textos están en `index.html`, `es/index.html` y `en/index.html`. Un cambio de texto en español se hace en los dos primeros.

## Ver en local

```
python3 -m http.server 8080
```

y abrir http://localhost:8080/
