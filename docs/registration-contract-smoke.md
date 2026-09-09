# Registration Contract Smoke

`Registration Contract Smoke` — отдельная ручная проверка HTTP-контракта регистрации PomidorQA.

Workflow находится в `.github/workflows/registration-contract-smoke.yml` и запускается **только через `workflow_dispatch`**. Он не входит в required PR checks, не запускается по `push`, `pull_request` или cron и поэтому не добавляет постоянную нагрузку на live-стенд.

## Что проверяется

Проверка открывает реальную страницу регистрации в Chromium, создаёт уникального тестового пользователя и валидирует цепочку:

```text
GET /pomidorqa/auth/register
          |
          v
fill registration form
          |
          v
POST /pomidorqa/auth/register
          |
          v
HTTP 303 See Other
          |
          v
/pomidorqa
```

Контракт считается успешным, если:

1. страница регистрации открывается без HTTP `4xx/5xx`;
2. после submit действительно наблюдается `POST /pomidorqa/auth/register`;
3. ответ mutation request имеет статус `303`;
4. браузер переходит на `/pomidorqa`.

Workflow намеренно фильтрует точный method + pathname, чтобы не перепутать регистрацию с другими POST-запросами страницы, например telemetry/track request.

## Зачем это отдельно от E2E

Обычные E2E проверяют бизнес-сценарий регистрации и дальнейшее пользовательское поведение. Contract Smoke нужен для быстрой ручной диагностики, когда важно ответить на более узкий вопрос: **изменился ли сетевой контракт регистрации**.

Это полезно при:

- расследовании timeout после submit;
- изменении backend redirect/status semantics;
- подозрении на regression именно в registration endpoint;
- проверке стенда до более широкого E2E-прогона.

## Артефакт

После запуска workflow сохраняет `.qa-artifacts/registration-contract/summary.json` как GitHub Actions artifact на 14 дней. Summary содержит ожидаемый и фактический method/path/status, финальный URL и текст ошибки при failure.

Пароль тестового пользователя в artifact не сохраняется.

## Ограничение

Каждый ручной запуск создаёт уникального пользователя на live-стенде. Поэтому workflow оставлен manual-only и не используется как scheduled или PR gate.
