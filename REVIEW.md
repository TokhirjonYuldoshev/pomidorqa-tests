# Review checklist

## BLOCKER

- [ ] Нет `test.only`, `page.pause()`, скрывающего проблему `skip`.
- [ ] Нет `waitForTimeout` или `force: true` как способа стабилизации.
- [ ] Тест не выбирает случайную бизнес-сущность через `.first()`.
- [ ] Созданные browser contexts закрываются в `finally`.
- [ ] Тестовые данные уникальны и сценарии независимы.

## MAJOR

- [ ] Spec содержит сценарий и assertions, а повторяемые локаторы/actions вынесены в POM.
- [ ] Повторяемый setup вынесен в helper.
- [ ] State-changing действие синхронизировано с observable signal.
- [ ] HTTP `>= 400` для mutation не игнорируется.
- [ ] Assertions проверяют конкретную сущность, а не «что-нибудь появилось».
- [ ] Verification step не выполняет скрытые бизнес-действия.
- [ ] Unit/API тесты находятся в соответствующем домене.

## MINOR

- [ ] Названия `describe`, `test`, `test.step` описывают бизнес-смысл.
- [ ] Предпочтены `role` / `label` / `testid` / стабильные data-атрибуты.
- [ ] Таймауты имеют понятную причину и не используются вместо синхронизации.
- [ ] POM не превращается в god object без необходимости.

## Перед merge

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:api
npm run test:e2e
```

Если live E2E падает, отдельно проверяем: это регрессия кода или недоступность общего стенда. Stability workflow запускается с `retries=0`.
