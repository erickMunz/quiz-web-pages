# quiz-web-pages

**Artefacto publicado. No editar a mano.**

Este repo contiene el build estático de [quiz-web](https://github.com/erickMunz/quiz-web),
servido en <https://erickmunz.github.io/quiz-web-pages/>.

## Cómo se regenera

Desde el repo `quiz-web` (el fuente, no este):

```bash
npm run deploy:pages
```

Ese script:
1. compila el sitio estático (`npm run build:static`, con `basePath=/quiz-web-pages`),
2. crea un repo git efímero dentro de `out/`,
3. force-pushea el contenido a la rama `main` de este repo.

Se puede sobrescribir con las variables de entorno `PAGES_REPO` y `PAGES_BRANCH`.

## Por qué existe como repo aparte

GitHub Pages sirve cada repo desde su propia raíz. Al usar
`basePath=/quiz-web-pages`, el sitio y sus assets cuelgan de
`/quiz-web-pages/...`, así que el build tiene que vivir en un repo cuyo
nombre coincida con ese prefijo.

## Consecuencia práctica

Cualquier cambio hay que hacerlo en `quiz-web` y volver a desplegar. Un commit
directo aquí se pierde en el siguiente deploy (el push es forzado).

Los ficheros con hash en `_next/static/` son restos de builds anteriores: el
deploy no limpia el repo, solo añade el build nuevo. Es inocuo, pero el repo
crece con cada despliegue.
