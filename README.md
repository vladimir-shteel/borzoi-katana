# BORZOI: Клинок в Зубах (Дальневосточный Dungeon Crawler)

Игра на Three.js + React + TypeScript (ECS архитектура).

## Как запустить локально

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
3. Откройте `http://localhost:3000` в браузере — произойдёт редирект на `http://localhost:3000/Borzoi-Katana/`.

Продакшн-сборка: `npm run build` (результат в `dist/`, проверить локально — `npx vite preview`).

## Публикация на GitHub Pages

Проект настроен на деплой по пути `/Borzoi-Katana/` (см. `base` в `vite.config.ts` и workflow `.github/workflows/deploy.yml`).

1. Создайте на GitHub репозиторий с именем `Borzoi-Katana` и запушьте код:
   ```bash
   git add .
   git commit -m "Borzoi Blade: Tokyo Abyss"
   git branch -M main
   git remote add origin https://github.com/<ваш-логин>/Borzoi-Katana.git
   git push -u origin main
   ```
2. В настройках репозитория: **Settings → Pages → Source** выберите **GitHub Actions**.
3. При каждом пуше в `main` игра автоматически собирается и публикуется по адресу
   `https://<ваш-логин>.github.io/Borzoi-Katana/`.

При переименовании репозитория поменяйте `base` в `vite.config.ts` на новый путь.

Примечание: автосохранения прогресса в игре нет — прогресс живёт только пока открыта вкладка.
