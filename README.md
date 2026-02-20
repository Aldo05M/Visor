# Visor Panorámico ORB

Este repositorio contiene el Visor Panorámico (carpeta `Visor_user`) listo para publicarse en GitHub Pages.

Instrucciones rápidas para publicar desde tu máquina local:

1. Asegúrate de tener `git` instalado y configurado.
2. Desde la raíz del proyecto (donde está este `README.md`) ejecuta:

```bash
git init
git add .
git commit -m "Initial commit - Visor Panorámico ORB"
git branch -M main
git remote add origin https://github.com/Aldo05M/Visor.git
git push -u origin main
```

3. Tras push, GitHub Actions se encargará de desplegar el contenido de la carpeta `Visor_user` a la rama `gh-pages` (workflow incluido). La página quedará disponible en:

```
https://Aldo05M.github.io/Visor/
```

Notas:
- Si tu hosting actual reescribe 404s (como InfinityFree), el visor incluye `Visor_user/img/index.json` para evitar el escaneo por prueba de archivos.
- Si prefieres que publique yo mismo en tu repo, necesito acceso (token) o que ejecutes los comandos anteriores en tu entorno.
# Visor Panorámico ORB

Pequeño proyecto de visor panorámico basado en Three.js para visualizar imágenes equirectangulares 360°.

Este repositorio contiene una interfaz de usuario para navegar por lugares y escenarios (panorámicas guardadas en `img/`).

## Preparar y probar localmente

- Recomendado: servir con un servidor estático para evitar problemas CORS (no uses `file://`). Por ejemplo:

```bash
# Python 3
python -m http.server 8000

# Abrir: http://localhost:8000/
```

- Alternativa: instalar `live-server` o usar extensiones de VS Code.

## Subir a GitHub

1. Inicializa el repositorio y sube a GitHub (remplaza `<tu-usuario>` y `<tu-repo>`):

```bash
git init
git add .
git commit -m "Initial commit - Visor panorámico ORB"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```

o usando GitHub CLI:

```bash
gh repo create <tu-usuario>/<tu-repo> --public --source=. --remote=origin
git push -u origin main
```

### Git LFS (recomendado si tienes muchas o grandes imágenes)

Si el directorio `img/` contiene muchos MBs de imágenes, usa Git LFS:

```bash
git lfs install
git lfs track "img/**"
git add .gitattributes
git add img/
git commit -m "Track images with Git LFS"
git push origin main
```

## GitHub Pages

Puedes publicar esto como sitio estático (GitHub Pages). Si quieres usar Pages desde la rama `main`, ve a la configuración del repo → Pages y selecciona la rama `main` y la carpeta `/`.

> Nota: GitHub Pages sirve `index.html` en la raíz; este repositorio incluye un `index.html` que redirige a `app_panoramica_modular.html`.

## Rutas y CORS

- Asegúrate de que las rutas relativas a `img/` estén en el repo. Si sirves las imágenes desde otra URL, ajusta las rutas en `Visor_user/Visor_user.js`.

## Licencia

Por defecto se incluye una licencia MIT. Cambiala si lo deseas.

---

Si quieres, puedo crear el repositorio en tu cuenta (necesitaré que uses `gh` localmente o me des permiso) o preparar un `workflow` para desplegar automáticamente a Pages.
