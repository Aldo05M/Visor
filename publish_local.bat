@echo off
echo Preparando commit y push al repo https://github.com/Aldo05M/Visor.git
git init
git add .
git commit -m "Prepare site for GitHub Pages"
git branch -M main
git remote add origin https://github.com/Aldo05M/Visor.git
git push -u origin main
echo Hecho. Revisa GitHub Actions para el despliegue.
