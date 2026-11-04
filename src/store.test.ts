import { describe, expect, test } from "bun:test";
import { MemoryStorage } from "./memory-storage";
import {
  type Category,
  type Checklist,
  type Data,
  DataError,
  type Item,
  loadData,
  STORAGE_KEY,
} from "./storage";
import { getChecklistView, getStats, Store } from "./store";

function makeStore(): { store: Store; storage: MemoryStorage } {
  const storage = new MemoryStorage();

  return { store: new Store(storage), storage };
}

function onlyChecklist(store: Store): Checklist {
  const checklist = store.data.checklists[0];

  if (!checklist) {
    throw new Error("В хранилище нет чеклиста");
  }

  return checklist;
}

function onlyCategory(checklist: Checklist): Category {
  const category = checklist.categories[0];

  if (!category) {
    throw new Error("В чеклисте нет категории");
  }

  return category;
}

function onlyItem(category: Category): Item {
  const item = category.items[0];

  if (!item) {
    throw new Error("В категории нет элемента");
  }

  return item;
}

function makeChecklist(categories: Category[]): Checklist {
  return { id: "checklist-1", title: "Сортировка", categories };
}

describe("CRUD чеклистов", () => {
  test("создаёт чеклист и сохраняет его", () => {
    const { store, storage } = makeStore();

    const checklist = store.createChecklist("  Поездка  ");

    expect(checklist.title).toBe("Поездка");
    expect(checklist.categories).toEqual([]);
    expect(store.data.checklists).toEqual([checklist]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("переименовывает чеклист", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Старое");

    store.renameChecklist(checklist.id, "  Новое  ");

    expect(onlyChecklist(store).title).toBe("Новое");
    expect(loadData(storage)).toEqual(store.data);
  });

  test("удаляет чеклист", () => {
    const { store, storage } = makeStore();
    const first = store.createChecklist("Первый");
    const second = store.createChecklist("Второй");

    store.deleteChecklist(first.id);

    expect(store.data.checklists).toEqual([second]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("не создаёт чеклист с пустым названием", () => {
    const { store, storage } = makeStore();

    expect(() => store.createChecklist("   ")).toThrow(
      "Название не может быть пустым",
    );
    expect(store.data.checklists).toEqual([]);
    expect(storage.items.size).toBe(0);
  });

  test("не переименовывает отсутствующий чеклист", () => {
    const { store } = makeStore();

    expect(() => store.renameChecklist("missing", "Новое")).toThrow(
      "Не удалось найти чеклист",
    );
    expect(store.data.checklists).toEqual([]);
  });

  test("не удаляет отсутствующий чеклист", () => {
    const { store } = makeStore();

    expect(() => store.deleteChecklist("missing")).toThrow(
      "Не удалось найти чеклист",
    );
  });
});

describe("CRUD категорий", () => {
  test("создаёт категорию в чеклисте", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");

    const category = store.createCategory(checklist.id, "  Кухня  ");

    expect(category.title).toBe("Кухня");
    expect(category.items).toEqual([]);
    expect(onlyChecklist(store).categories).toEqual([category]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("переименовывает категорию", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");
    const category = store.createCategory(checklist.id, "Старое");

    store.renameCategory(checklist.id, category.id, "  Новое  ");

    expect(onlyCategory(onlyChecklist(store)).title).toBe("Новое");
    expect(loadData(storage)).toEqual(store.data);
  });

  test("удаляет категорию вместе с элементами", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");
    const category = store.createCategory(checklist.id, "Кухня");
    store.createItem(checklist.id, category.id, "Плита");

    store.deleteCategory(checklist.id, category.id);

    expect(onlyChecklist(store).categories).toEqual([]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("не создаёт категорию в отсутствующем чеклисте", () => {
    const { store } = makeStore();

    expect(() => store.createCategory("missing", "Кухня")).toThrow(
      "Не удалось найти чеклист",
    );
    expect(store.data.checklists).toEqual([]);
  });

  test("не создаёт категорию с пустым названием", () => {
    const { store } = makeStore();
    const checklist = store.createChecklist("Дом");

    expect(() => store.createCategory(checklist.id, "  ")).toThrow(
      "Название не может быть пустым",
    );
    expect(onlyChecklist(store).categories).toEqual([]);
  });

  test("не переименовывает отсутствующую категорию", () => {
    const { store } = makeStore();
    const checklist = store.createChecklist("Дом");

    expect(() =>
      store.renameCategory(checklist.id, "missing", "Новое"),
    ).toThrow("Не удалось найти категорию");
  });

  test("не удаляет отсутствующую категорию", () => {
    const { store } = makeStore();
    const checklist = store.createChecklist("Дом");

    expect(() => store.deleteCategory(checklist.id, "missing")).toThrow(
      "Не удалось найти категорию",
    );
  });
});

describe("CRUD элементов", () => {
  function setup() {
    const context = makeStore();
    const checklist = context.store.createChecklist("Дом");
    const category = context.store.createCategory(checklist.id, "Кухня");

    return { ...context, checklist, category };
  }

  test("создаёт элемент в категории", () => {
    const { store, storage, checklist, category } = setup();

    const item = store.createItem(checklist.id, category.id, "  Плита  ");

    expect(item).toMatchObject({ title: "Плита", checked: false });
    expect(onlyItem(onlyCategory(onlyChecklist(store))).id).toBe(item.id);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("переименовывает элемент", () => {
    const { store, storage, checklist, category } = setup();
    const item = store.createItem(checklist.id, category.id, "Старое");

    store.renameItem(checklist.id, category.id, item.id, "  Новое  ");

    expect(onlyItem(onlyCategory(onlyChecklist(store))).title).toBe("Новое");
    expect(loadData(storage)).toEqual(store.data);
  });

  test("переключает отметку", () => {
    const { store, storage, checklist, category } = setup();
    const item = store.createItem(checklist.id, category.id, "Плита");

    store.setItemChecked(checklist.id, category.id, item.id, true);

    expect(onlyItem(onlyCategory(onlyChecklist(store))).checked).toBe(true);
    expect(loadData(storage)).toEqual(store.data);

    store.setItemChecked(checklist.id, category.id, item.id, false);

    expect(onlyItem(onlyCategory(onlyChecklist(store))).checked).toBe(false);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("удаляет элемент", () => {
    const { store, storage, checklist, category } = setup();
    const first = store.createItem(checklist.id, category.id, "Первый");
    const second = store.createItem(checklist.id, category.id, "Второй");

    store.deleteItem(checklist.id, category.id, first.id);

    expect(onlyCategory(onlyChecklist(store)).items).toEqual([second]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("не создаёт элемент в отсутствующей категории", () => {
    const { store, checklist } = setup();

    expect(() => store.createItem(checklist.id, "missing", "Плита")).toThrow(
      "Не удалось найти категорию",
    );
    expect(onlyCategory(onlyChecklist(store)).items).toEqual([]);
  });

  test("не создаёт элемент с пустым названием", () => {
    const { store, checklist, category } = setup();

    expect(() => store.createItem(checklist.id, category.id, "  ")).toThrow(
      "Название не может быть пустым",
    );
    expect(onlyCategory(onlyChecklist(store)).items).toEqual([]);
  });

  test("не переименовывает отсутствующий элемент", () => {
    const { store, checklist, category } = setup();

    expect(() =>
      store.renameItem(checklist.id, category.id, "missing", "Новое"),
    ).toThrow("Не удалось найти элемент");
  });

  test("не переключает отсутствующий элемент", () => {
    const { store, checklist, category } = setup();

    expect(() =>
      store.setItemChecked(checklist.id, category.id, "missing", true),
    ).toThrow("Не удалось найти элемент");
  });

  test("не удаляет отсутствующий элемент", () => {
    const { store, checklist, category } = setup();

    expect(() =>
      store.deleteItem(checklist.id, category.id, "missing"),
    ).toThrow("Не удалось найти элемент");
  });
});

describe("Каскадное удаление", () => {
  test("удаление чеклиста удаляет его категории и элементы", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");
    const category = store.createCategory(checklist.id, "Кухня");
    store.createItem(checklist.id, category.id, "Плита");

    store.deleteChecklist(checklist.id);

    expect(store.data.checklists).toEqual([]);
    expect(loadData(storage)).toEqual(store.data);
  });

  test("удаление категории не затрагивает другие категории", () => {
    const { store } = makeStore();
    const checklist = store.createChecklist("Дом");
    const kitchen = store.createCategory(checklist.id, "Кухня");
    const bathroom = store.createCategory(checklist.id, "Ванная");
    store.createItem(checklist.id, kitchen.id, "Плита");
    const mirror = store.createItem(checklist.id, bathroom.id, "Зеркало");

    store.deleteCategory(checklist.id, kitchen.id);

    expect(onlyChecklist(store).categories).toEqual([
      { ...bathroom, items: [mirror] },
    ]);
  });
});

describe("Сохранение через MemoryStorage", () => {
  test("новый Store читает сохранённые данные", () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    const checklist = store.createChecklist("Дом");
    const category = store.createCategory(checklist.id, "Кухня");
    store.createItem(checklist.id, category.id, "Плита");

    const reopened = new Store(storage);

    expect(reopened.data).toEqual(store.data);
  });

  test("ошибка мутации не меняет состояние и хранилище", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");
    store.createCategory(checklist.id, "Кухня");
    const before = storage.getItem(STORAGE_KEY);

    expect(() => store.deleteCategory(checklist.id, "missing")).toThrow(
      "Не удалось найти категорию",
    );

    expect(store.data.checklists).toHaveLength(1);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  test("Store с битыми данными сообщает DataError", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{");

    expect(() => new Store(storage)).toThrow(DataError);
  });
});

describe("getChecklistView: сортировка", () => {
  test("пустые и незавершённые категории по алфавиту, завершённые в конце", () => {
    const checklist = makeChecklist([
      {
        id: "done",
        title: "Бананы",
        items: [{ id: "done-item", title: "Купить", checked: true }],
      },
      {
        id: "unfinished",
        title: "Яблоки",
        items: [{ id: "unfinished-item", title: "Купить", checked: false }],
      },
      { id: "empty", title: "Абрикосы", items: [] },
    ]);

    const view = getChecklistView(checklist);

    expect(view.categories.map((category) => category.title)).toEqual([
      "Абрикосы",
      "Яблоки",
      "Бананы",
    ]);
  });

  test("незавершённые категории не считаются завершёнными", () => {
    const checklist = makeChecklist([
      {
        id: "partly",
        title: "Абрикосы",
        items: [
          { id: "a", title: "Один", checked: true },
          { id: "b", title: "Два", checked: false },
        ],
      },
      {
        id: "done",
        title: "Бананы",
        items: [{ id: "c", title: "Три", checked: true }],
      },
    ]);

    const view = getChecklistView(checklist);

    expect(view.categories.map((category) => category.title)).toEqual([
      "Абрикосы",
      "Бананы",
    ]);
  });

  test("сортирует элементы: неотмеченные по алфавиту, отмеченные в конце", () => {
    const checklist = makeChecklist([
      {
        id: "category",
        title: "Категория",
        items: [
          { id: "1", title: "Яблоко", checked: false },
          { id: "2", title: "Арбуз", checked: true },
          { id: "3", title: "Банан", checked: false },
          { id: "4", title: "Апельсин", checked: true },
        ],
      },
    ]);

    const view = getChecklistView(checklist);

    expect(view.categories[0]?.items.map((item) => item.title)).toEqual([
      "Банан",
      "Яблоко",
      "Апельсин",
      "Арбуз",
    ]);
  });

  test("не меняет исходный порядок категорий и элементов", () => {
    const checklist = makeChecklist([
      {
        id: "second",
        title: "Яблоки",
        items: [
          { id: "1", title: "Я", checked: false },
          { id: "2", title: "А", checked: false },
        ],
      },
      { id: "first", title: "Абрикосы", items: [] },
    ]);

    getChecklistView(checklist);

    expect(checklist.categories.map((category) => category.id)).toEqual([
      "second",
      "first",
    ]);
    expect(checklist.categories[0]?.items.map((item) => item.title)).toEqual([
      "Я",
      "А",
    ]);
  });

  test("Store.getChecklistView возвращает null для отсутствующего чеклиста", () => {
    const { store } = makeStore();

    expect(store.getChecklistView("missing")).toBeNull();
  });

  test("Store.getChecklistView возвращает представление с сортировкой", () => {
    const { store } = makeStore();
    const checklist = store.createChecklist("Дом");
    store.createCategory(checklist.id, "Яблоки");
    store.createCategory(checklist.id, "Абрикосы");

    const view = store.getChecklistView(checklist.id);

    expect(view?.title).toBe("Дом");
    expect(view?.categories.map((category) => category.title)).toEqual([
      "Абрикосы",
      "Яблоки",
    ]);
  });
});

describe("Статистика", () => {
  test("пустой чеклист", () => {
    expect(getStats(makeChecklist([]))).toEqual({
      total: 0,
      checked: 0,
      remaining: 0,
      percent: 0,
    });
  });

  test("считает отмеченные и оставшиеся", () => {
    const checklist = makeChecklist([
      {
        id: "category",
        title: "Категория",
        items: [
          { id: "1", title: "Один", checked: true },
          { id: "2", title: "Два", checked: true },
          { id: "3", title: "Три", checked: false },
          { id: "4", title: "Четыре", checked: false },
          { id: "5", title: "Пять", checked: false },
        ],
      },
    ]);

    expect(getStats(checklist)).toEqual({
      total: 5,
      checked: 2,
      remaining: 3,
      percent: 40,
    });
  });

  test("округляет процент", () => {
    const oneOfThree = makeChecklist([
      {
        id: "category",
        title: "Категория",
        items: [
          { id: "1", title: "Один", checked: true },
          { id: "2", title: "Два", checked: false },
          { id: "3", title: "Три", checked: false },
        ],
      },
    ]);
    const twoOfThree = structuredClone(oneOfThree);
    const secondItem = twoOfThree.categories[0]?.items[1];

    if (!secondItem) {
      throw new Error("В фикстуре нет элемента");
    }

    secondItem.checked = true;

    expect(getStats(oneOfThree).percent).toBe(33);
    expect(getStats(twoOfThree).percent).toBe(67);
  });

  test("всё отмечено — 100%", () => {
    const checklist = makeChecklist([
      {
        id: "category",
        title: "Категория",
        items: [
          { id: "1", title: "Один", checked: true },
          { id: "2", title: "Два", checked: true },
        ],
      },
    ]);

    expect(getStats(checklist)).toEqual({
      total: 2,
      checked: 2,
      remaining: 0,
      percent: 100,
    });
  });

  test("представление считает статистику чеклиста и категорий", () => {
    const checklist = makeChecklist([
      {
        id: "done",
        title: "Готово",
        items: [{ id: "1", title: "Один", checked: true }],
      },
      {
        id: "empty",
        title: "Пусто",
        items: [],
      },
    ]);

    const view = getChecklistView(checklist);
    const done = view.categories.find((category) => category.id === "done");
    const empty = view.categories.find((category) => category.id === "empty");

    expect(view.stats).toEqual({
      total: 1,
      checked: 1,
      remaining: 0,
      percent: 100,
    });
    expect(done?.stats).toEqual({
      total: 1,
      checked: 1,
      remaining: 0,
      percent: 100,
    });
    expect(empty?.stats).toEqual({
      total: 0,
      checked: 0,
      remaining: 0,
      percent: 0,
    });
  });
});

describe("resetChecked", () => {
  test("снимает отметки только у выбранного чеклиста", () => {
    const { store, storage } = makeStore();
    const first = store.createChecklist("Первый");
    const firstCategory = store.createCategory(first.id, "Категория");
    const firstItem = store.createItem(first.id, firstCategory.id, "Пункт");
    store.setItemChecked(first.id, firstCategory.id, firstItem.id, true);

    const second = store.createChecklist("Второй");
    const secondCategory = store.createCategory(second.id, "Категория");
    const secondItem = store.createItem(second.id, secondCategory.id, "Пункт");
    store.setItemChecked(second.id, secondCategory.id, secondItem.id, true);

    store.resetChecked(first.id);

    expect(store.data.checklists[0]?.categories[0]?.items[0]?.checked).toBe(
      false,
    );
    expect(store.data.checklists[1]?.categories[0]?.items[0]?.checked).toBe(
      true,
    );
    expect(loadData(storage)).toEqual(store.data);
  });

  test("не меняет состояние для отсутствующего чеклиста", () => {
    const { store, storage } = makeStore();
    const checklist = store.createChecklist("Дом");
    const category = store.createCategory(checklist.id, "Кухня");
    const item = store.createItem(checklist.id, category.id, "Плита");
    store.setItemChecked(checklist.id, category.id, item.id, true);
    const before = storage.getItem(STORAGE_KEY);

    expect(() => store.resetChecked("missing")).toThrow(
      "Не удалось найти чеклист",
    );
    expect(onlyItem(onlyCategory(onlyChecklist(store))).checked).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
});

describe("Импорт и экспорт", () => {
  test("экспорт возвращает данные в формате JSON", () => {
    const { store } = makeStore();
    store.createChecklist("Дом");

    expect(JSON.parse(store.exportData())).toEqual(store.data);
  });

  test("импорт заменяет данные и сохраняется", () => {
    const { store, storage } = makeStore();
    store.createChecklist("Старый");
    const imported: Data = {
      checklists: [
        {
          id: "imported",
          title: "Импорт",
          categories: [
            {
              id: "category",
              title: "Категория",
              items: [{ id: "item", title: "Пункт", checked: true }],
            },
          ],
        },
      ],
    };

    store.importData(JSON.stringify(imported));

    expect(store.data).toEqual(imported);
    expect(loadData(storage)).toEqual(imported);
  });

  test("импорт пустых данных очищает чеклисты", () => {
    const { store, storage } = makeStore();
    store.createChecklist("Старый");

    store.importData(JSON.stringify({ checklists: [] }));

    expect(store.data).toEqual({ checklists: [] });
    expect(loadData(storage)).toEqual({ checklists: [] });
  });

  test("экспорт и импорт в другой Store", () => {
    const source = new Store(new MemoryStorage());
    const checklist = source.createChecklist("Дом");
    const category = source.createCategory(checklist.id, "Кухня");
    source.createItem(checklist.id, category.id, "Плита");
    const targetStore = new Store(new MemoryStorage());

    targetStore.importData(source.exportData());

    expect(targetStore.data).toEqual(source.data);
  });

  test("битый импорт не меняет состояние и хранилище", () => {
    const { store, storage } = makeStore();
    store.createChecklist("Был");
    const before = storage.getItem(STORAGE_KEY);

    expect(() => store.importData("{")).toThrow(DataError);

    expect(store.data.checklists.map((checklist) => checklist.title)).toEqual([
      "Был",
    ]);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  test("импорт с дубликатами id отклоняется", () => {
    const { store, storage } = makeStore();
    store.createChecklist("Был");
    const before = storage.getItem(STORAGE_KEY);
    const duplicate = { id: "same", title: "Дом", categories: [] };

    expect(() =>
      store.importData(JSON.stringify({ checklists: [duplicate, duplicate] })),
    ).toThrow(DataError);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
});
