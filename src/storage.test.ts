import { describe, expect, test } from "bun:test";
import { MemoryStorage } from "./memory-storage";
import {
  clearData,
  createEmptyData,
  type Data,
  DataError,
  loadData,
  parseData,
  STORAGE_KEY,
  type StorageLike,
  saveData,
  serializeData,
} from "./storage";

function validData(): Data {
  return {
    checklists: [
      {
        id: "checklist-1",
        title: "Поездка",
        categories: [
          {
            id: "category-1",
            title: "Документы",
            items: [
              { id: "item-1", title: "Паспорт", checked: true },
              { id: "item-2", title: "Билеты", checked: false },
            ],
          },
        ],
      },
    ],
  };
}

function firstChecklist(data: Data) {
  const checklist = data.checklists[0];

  if (!checklist) {
    throw new Error("В фикстуре нет чеклиста");
  }

  return checklist;
}

function brokenStorage(): StorageLike {
  const fail = (): never => {
    throw new Error("storage failure");
  };

  return { getItem: fail, setItem: fail, removeItem: fail };
}

const rawChecklist = { id: "checklist-1", title: "Поездка", categories: [] };
const rawCategory = { id: "category-1", title: "Документы", items: [] };
const rawItem = { id: "item-1", title: "Паспорт", checked: false };

const invalidCases: Array<[string, unknown]> = [
  ["данные не объект", null],
  ["данные — массив", []],
  ["нет поля checklists", {}],
  ["checklists не массив", { checklists: {} }],
  ["чеклист не объект", { checklists: [null] }],
  [
    "пустой id чеклиста",
    { checklists: [{ id: "  ", title: "Поездка", categories: [] }] },
  ],
  [
    "id чеклиста не строка",
    { checklists: [{ id: 1, title: "Поездка", categories: [] }] },
  ],
  [
    "title чеклиста не строка",
    { checklists: [{ id: "checklist-1", title: null, categories: [] }] },
  ],
  [
    "categories не массив",
    { checklists: [{ id: "checklist-1", title: "Поездка", categories: {} }] },
  ],
  [
    "категория не объект",
    {
      checklists: [{ id: "checklist-1", title: "Поездка", categories: [null] }],
    },
  ],
  [
    "пустой id категории",
    {
      checklists: [
        {
          id: "checklist-1",
          title: "Поездка",
          categories: [{ id: "", title: "Документы", items: [] }],
        },
      ],
    },
  ],
  [
    "items не массив",
    {
      checklists: [
        {
          id: "checklist-1",
          title: "Поездка",
          categories: [{ id: "category-1", title: "Документы", items: {} }],
        },
      ],
    },
  ],
  [
    "элемент не объект",
    {
      checklists: [
        {
          id: "checklist-1",
          title: "Поездка",
          categories: [{ id: "category-1", title: "Документы", items: [null] }],
        },
      ],
    },
  ],
  [
    "пустой id элемента",
    {
      checklists: [
        {
          id: "checklist-1",
          title: "Поездка",
          categories: [
            {
              id: "category-1",
              title: "Документы",
              items: [{ id: " ", title: "Паспорт", checked: false }],
            },
          ],
        },
      ],
    },
  ],
  [
    "checked не boolean",
    {
      checklists: [
        {
          id: "checklist-1",
          title: "Поездка",
          categories: [
            {
              id: "category-1",
              title: "Документы",
              items: [{ id: "item-1", title: "Паспорт", checked: "да" }],
            },
          ],
        },
      ],
    },
  ],
  ["дубликат id чеклистов", { checklists: [rawChecklist, rawChecklist] }],
  [
    "дубликат id категорий",
    {
      checklists: [{ ...rawChecklist, categories: [rawCategory, rawCategory] }],
    },
  ],
  [
    "дубликат id элементов",
    {
      checklists: [
        {
          ...rawChecklist,
          categories: [{ ...rawCategory, items: [rawItem, rawItem] }],
        },
      ],
    },
  ],
];

describe("createEmptyData", () => {
  test("возвращает пустой список чеклистов", () => {
    expect(createEmptyData()).toEqual({ checklists: [] });
  });
});

describe("parseData / serializeData", () => {
  test("разбирает корректные данные", () => {
    const data = validData();

    expect(parseData(JSON.stringify(data))).toEqual(data);
  });

  test("сериализует и восстанавливает данные без потерь", () => {
    const data = validData();

    expect(parseData(serializeData(data))).toEqual(data);
  });

  test("отклоняет невалидный JSON", () => {
    expect(() => parseData("{")).toThrow(DataError);
  });

  test("сохраняет исходную ошибку JSON как причину", () => {
    try {
      parseData("{");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect((error as DataError).cause).toBeInstanceOf(SyntaxError);
    }
  });

  test("сериализация проверяет данные", () => {
    const data = validData();
    data.checklists.push(structuredClone(firstChecklist(data)));

    expect(() => serializeData(data)).toThrow(DataError);
  });

  for (const [name, payload] of invalidCases) {
    test(`отклоняет: ${name}`, () => {
      expect(() => parseData(JSON.stringify(payload))).toThrow(DataError);
    });
  }
});

describe("loadData", () => {
  test("возвращает пустые данные, если значения нет", () => {
    expect(loadData(new MemoryStorage())).toEqual(createEmptyData());
  });

  test("читает данные по ключу", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(validData()));

    expect(loadData(storage)).toEqual(validData());
  });

  test("оборачивает ошибку чтения в DataError", () => {
    expect(() => loadData(brokenStorage())).toThrow(DataError);
  });

  test("оборачивает битые данные в DataError", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{");

    expect(() => loadData(storage)).toThrow(DataError);
  });
});

describe("saveData", () => {
  test("сохраняет данные под ключом", () => {
    const storage = new MemoryStorage();
    const data = validData();

    saveData(storage, data);

    expect(storage.getItem(STORAGE_KEY)).toBe(serializeData(data));
  });

  test("не пишет невалидные данные", () => {
    const storage = new MemoryStorage();
    const data = validData();
    data.checklists.push(structuredClone(firstChecklist(data)));

    expect(() => saveData(storage, data)).toThrow(DataError);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("оборачивает ошибку записи в DataError", () => {
    expect(() => saveData(brokenStorage(), validData())).toThrow(DataError);
  });
});

describe("clearData", () => {
  test("удаляет сохранённые данные", () => {
    const storage = new MemoryStorage();
    saveData(storage, validData());

    clearData(storage);

    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("оборачивает ошибку удаления в DataError", () => {
    expect(() => clearData(brokenStorage())).toThrow(DataError);
  });
});
