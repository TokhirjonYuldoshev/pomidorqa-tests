# Матрица покрытия PomidorQA

Покрытие считается по 50 функциональным требованиям MVP из [`requirements.md`](../requirements.md).
Исходники PomidorQA в этот репозиторий не входят, поэтому матрица измеряет **requirement coverage**,
а не code coverage продукта.

Срез: **19.09.2026**, ветка `hw16-coverage-100`, стенд `https://aiqa.su/pomidorqa`.

## Правила статусов

| Статус | Критерий |
|---|---|
| `automated` | есть автоматизированная проверка, которая должна сигнализировать при нарушении требования |
| `partial` | наблюдаемая часть требования покрыта, но скрытая/server-side часть не доказана live black-box проверкой |
| `known defect` | тест написан по требованию и помечен `test.fail()`, потому что текущий продукт ему не соответствует |
| `out of scope` | нужное состояние недостижимо через доступные black-box интерфейсы без искусственного ожидания/доступа к БД |

## Сводка

| Статус | Требований | Доля |
|---|---:|---:|
| `automated` | **45** | **90%** |
| `partial` | **2** | **4%** |
| `known defect` | **1** | **2%** |
| `out of scope` | **2** | **4%** |
| **Всего** | **50** | **100%** |

**Автоматизированное покрытие требований: 45 / 50 = 90%.**

**Полнота аудита: 50 / 50 требований имеют определённый статус = 100%.**

Статус определён для всех 50 требований. В матрице нет требований без результата аудита.
Для курса учитывается распределение проверок по уровням: browser E2E подтверждает пользовательское
поведение live PomidorQA, live API — контракт стенда, а локальный API-мок используется как
автоматизированная проверка явно смоделированного бизнес-контракта бронирования. При этом локальный
мок не выдаётся за прямое доказательство внутренней реализации production-сервиса.

## 3. Роли пользователей

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R3.1 | Гость просматривает каталог | `automated` | `tests/e2e/catalog-search.spec.ts` |
| R3.2 | Гость открывает страницу участника и видит свободные слоты | `automated` | `tests/e2e/guest-access.spec.ts`, `tests/e2e/slots-management.spec.ts` |
| R3.3 | Гость не может забронировать звонок | `automated` | `tests/e2e/guest-access.spec.ts` |
| R3.4 | Приватные страницы гостю недоступны | `automated` | `tests/e2e/auth-session.spec.ts` |
| R3.5 | Участник редактирует профиль и навыки | `automated` | `tests/e2e/profile-flow.spec.ts`, `tests/e2e/profile-rules.spec.ts` |
| R3.6 | Участник добавляет и удаляет свои свободные слоты | `automated` | `tests/e2e/slots-management.spec.ts`, `tests/e2e/slots-rules.spec.ts` |
| R3.7 | Участник бронирует слоты других участников | `automated` | `tests/e2e/booking-flow.spec.ts` |
| R3.8 | Отменить бронирование может и хост, и гость | `automated` | `tests/e2e/booking-cancel.spec.ts`, `tests/e2e/booking-host-cancel.spec.ts` |
| R3.9 | Участник видит список своих встреч | `automated` | `tests/e2e/booking-flow.spec.ts` |

## 4. Регистрация и вход

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R4.1 | Имя, email и пароль обязательны | `automated` | `tests/e2e/auth-registration.spec.ts` |
| R4.2 | Пароль не короче 8 символов | `automated` | `tests/e2e/auth-registration.spec.ts`, `tests/api/user-registration-live.spec.ts` |
| R4.3 | После регистрации профиль содержит имя из формы и `Europe/Moscow` | `automated` | `tests/e2e/auth-registration.spec.ts` |
| R4.4 | Второй аккаунт на тот же email не создаётся | `automated` | `tests/api/user-registration-live.spec.ts` |
| R4.5 | Ошибка входа одинаковая и не раскрывает неверное поле | `automated` | `tests/e2e/login-error.spec.ts` |
| R4.6 | Успешный вход держит сессию, выход её закрывает | `automated` | `tests/e2e/auth-session.spec.ts`, `tests/e2e/auth-session-consistency.spec.ts` |

## 5. Профиль

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R5.1 | Имя — обязательное поле | `automated` | `tests/e2e/profile-rules.spec.ts` |
| R5.2 | Telegram — необязательный свободный текст | `automated` | `tests/e2e/profile-flow.spec.ts`, `tests/e2e/profile-rules.spec.ts` |
| R5.3 | Часовой пояс выбирается из списка | `automated` | `tests/e2e/profile-flow.spec.ts` |
| R5.4 | «О себе» — необязательное свободное описание | `automated` | `tests/e2e/profile-flow.spec.ts`, `tests/e2e/profile-rules.spec.ts` |
| R5.5 | Время слотов показывается в часовом поясе владельца | `automated` | `tests/e2e/slot-timezone.spec.ts` |
| R5.6 | Профиль виден другим участникам | `automated` | `tests/e2e/public-profile.spec.ts` |

## 6. Навыки

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R6.1 | Навык имеет тип `can_help` или `want_to_learn` | `automated` | `tests/e2e/profile-flow.spec.ts` |
| R6.2 | Название навыка — свободный текст | `automated` | `tests/e2e/catalog-search-data.spec.ts`, `tests/e2e/catalog-search-edge-data.spec.ts`, `tests/e2e/catalog-search-boundaries.spec.ts` |
| R6.3 | Один и тот же навык одного типа нельзя добавить повторно | `automated` | `tests/e2e/profile-rules.spec.ts` |
| R6.4 | Тот же навык другого типа — отдельная запись | `automated` | `tests/e2e/profile-rules.spec.ts` |
| R6.5 | Участник удаляет свой навык | `automated` | `tests/e2e/profile-flow.spec.ts` |
| R6.6 | Пустой навык не добавляется | `automated` | `tests/e2e/profile-flow.spec.ts` |

## 7. Слоты доступности

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R7.1 | Длительность слота фиксированная — 25 минут | `out of scope` | фактический `end_time` не выдаётся доступным интерфейсом; подпись «25 минут» не доказывает серверную длительность |
| R7.2 | Нельзя создать слот в прошлом | `partial` | `tests/e2e/slots-rules.spec.ts` проверяет client-side запрет; server-side правило через UI недостижимо |
| R7.3 | У слота статус `free` или `booked` | `automated` | `tests/e2e/slots-rules.spec.ts` проверяет `data-slot-status` до и после бронирования |
| R7.4 | Свой свободный слот можно удалить | `automated` | `tests/e2e/slots-rules.spec.ts` |
| R7.5 | Забронированный слот удалить нельзя | `partial` | `tests/e2e/slots-rules.spec.ts` проверяет отсутствие UI-кнопки удаления; прямой server-side обход UI не выполняется |

## 8. Каталог участников

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R8.1 | В каталоге только участники со свободным будущим слотом | `automated` | `tests/e2e/catalog-search.spec.ts`, `tests/e2e/catalog-booking-availability.spec.ts` |
| R8.2 | Участник не видит себя в собственном каталоге | `automated` | `tests/e2e/catalog-search.spec.ts`, `tests/e2e/catalog-search-data.spec.ts` |
| R8.3 | Поиск фильтрует только по навыкам `can_help` | **`known defect`** | `tests/e2e/catalog-search-data.spec.ts`, `tests/e2e/catalog-search-boundaries.spec.ts` — проверки по требованию помечены `test.fail()` |
| R8.4 | По неизвестному навыку выдача пустая | `automated` | `tests/e2e/catalog-search.spec.ts` |

## 9. Страница участника

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R9.1 | Видны имя, «о себе», оба типа навыков и свободные слоты | `automated` | `tests/e2e/public-profile.spec.ts` |
| R9.2 | Забронированные слоты не показываются | `automated` | `tests/e2e/booking-state.spec.ts` |
| R9.3 | Прошедшие слоты не показываются | `out of scope` | продукт не позволяет создать слот в прошлом; ждать естественного устаревания неприемлемо для регрессии |

## 10. Бронирование звонка

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R10.1 | Свой слот забронировать нельзя | `automated` | `tests/api/booking-api.spec.ts` проверяет контракт `cannot_book_own_slot`; `tests/e2e/catalog-search.spec.ts` дополнительно подтверждает self-exclusion в live UI |
| R10.2 | Забронировать можно только свободный слот в будущем | `automated` | `tests/api/booking-api.spec.ts` проверяет отказ для past и already booked; `tests/e2e/booking-flow.spec.ts` подтверждает live happy path и гонку за свободный слот |
| R10.3 | После брони слот `booked`, бронирование `confirmed` | `automated` | `tests/e2e/slots-rules.spec.ts`, `tests/e2e/booking-flow.spec.ts` |
| R10.4 | При гонке подтверждается ровно одна бронь, второй видит ошибку | `automated` | `tests/e2e/booking-flow.spec.ts` |
| R10.5 | Закрытие окна подтверждения не создаёт бронь | `automated` | `tests/e2e/booking-state.spec.ts` |

## 11. Отмена бронирования

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R11.1 | Отменить может любой из двух участников | `automated` | `tests/e2e/booking-cancel.spec.ts`, `tests/e2e/booking-host-cancel.spec.ts` |
| R11.2 | Отмена запрещена позднее чем за 2 часа до начала | `automated` | `tests/e2e/cancel-window.spec.ts` |
| R11.3 | После отмены слот снова свободен и доступен другому | `automated` | `tests/e2e/catalog-booking-recovery.spec.ts` |

## 12. Мои встречи

| ID | Требование | Статус | Доказательство |
|---|---|---|---|
| R12.1 | Показаны брони, где участник хост или гость | `automated` | `tests/e2e/booking-flow.spec.ts` |
| R12.2 | Два списка: «Ближайшие» и «Прошедшие и отменённые» | `automated` | `tests/e2e/booking-state.spec.ts`, `tests/e2e/booking-cancel.spec.ts`, `tests/e2e/booking-host-cancel.spec.ts` проверяют ближайшие и перенос отменённой встречи во второй список |
| R12.3 | Отменить можно только из «Ближайших» | `automated` | `tests/e2e/booking-host-cancel.spec.ts` проверяет отмену из ближайших и отсутствие кнопки у отменённой карточки |

## KD-3 — каталог ищет по `want_to_learn`

Требование R8.3 говорит, что фильтр каталога должен учитывать навыки из раздела
«могу помочь» (`can_help`). Текущий продукт также возвращает участников, у которых
совпадение есть только в `want_to_learn`.

Ветка HW16 исправляет прежнюю проблему тестового набора: сценарии больше не фиксируют
фактическое ошибочное поведение как правильное. Проверки переписаны **по требованию** и
помечены `test.fail()`. Пока дефект жив, ожидаемое падение не красит регрессию. Если
продукт исправят, Playwright сообщит, что expected-failure неожиданно прошёл — это сигнал
снять `test.fail()`.

## Как трактуются уровни покрытия

Матрица следует методике Урока 16: требование считается `automated`, если для него есть
автоматизированная проверка на подходящем уровне и связь «требование → тест» явно зафиксирована.
`tests/api/booking-api.spec.ts` моделирует бизнес-контракты бронирования на локальном API-уровне,
а live E2E проверяет интегрированное пользовательское поведение PomidorQA.

Это не означает, что локальный mock исполняет production-код PomidorQA. В описании проекта
уровень доказательства указывается явно. `tests/api/user-registration-live.spec.ts`, в отличие
от mock API, обращается к тестовому API реального стенда.

## Проверяемость результата

- спецификация: `requirements.md`;
- матрица: этот файл;
- карта suites: `docs/test-coverage.md`;
- полный quality gate: `npm run gate`;
- полный прогон с метриками: `npm run regression:metrics`;
- машинные отчёты: JSON + JUnit;
- CI: push в `main`, Pull Request и ручной запуск;
- E2E CI: Chromium + Firefox + WebKit, `workers=4` на браузер, `retries=0`.
