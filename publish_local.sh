#!/usr/bin/env bash
set -e

echo "Inicializando repo local y enviando a https://github.com/Aldo05M/Visor.git"
git init
git add .
git commit -m "Prepare site for GitHub Pages"
git branch -M main
git remote add origin https://github.com/Aldo05M/Visor.git
git push -u origin main

echo "Pushed. Espera a que GitHub Actions despliegue (ver Actions → Deploy)."
