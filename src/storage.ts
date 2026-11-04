export interface Item {
  id: string;
  title: string;
  checked: boolean;
}

export interface Category {
  id: string;
  title: string;
  items: Item[];
}

export interface Checklist {
  id: string;
  title: string;
  categories: Category[];
}

export interface Data {
  checklists: Checklist[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY = "checklist:v1";

export class DataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataError";
  }
}

export function createEmptyData(): Data {
  return { checklists: [] };
}

export function parseData(raw: string): Data {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new DataError("Не удалось разобрать JSON", { cause: error });
  }

  return validateData(value);
}

export function serializeData(data: Data): string {
  return JSON.stringify(validateData(data));
}

export function loadData(storage: StorageLike): Data {
  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new DataError("Не удалось прочитать данные", { cause: error });
  }

  return raw === null ? createEmptyData() : parseData(raw);
}

export function saveData(storage: StorageLike, data: Data): void {
  const raw = serializeData(data);

  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch (error) {
    throw new DataError("Не удалось сохранить данные", { cause: error });
  }
}

export function clearData(storage: StorageLike): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    throw new DataError("Не удалось удалить данные", { cause: error });
  }
}

function validateData(value: unknown): Data {
  if (!isRecord(value)) {
    fail("data", "объект");
  }

  if (!Array.isArray(value.checklists)) {
    fail("data.checklists", "массив");
  }

  const checklistIds = new Set<string>();
  const checklists = value.checklists.map((rawChecklist, checklistIndex) => {
    const path = `checklists[${checklistIndex}]`;

    if (!isRecord(rawChecklist)) {
      fail(path, "объект");
    }

    const id = readId(rawChecklist.id, `${path}.id`);
    assertUnique(checklistIds, id, `${path}.id`);
    const title = readString(rawChecklist.title, `${path}.title`);

    if (!Array.isArray(rawChecklist.categories)) {
      fail(`${path}.categories`, "массив");
    }

    const categoryIds = new Set<string>();
    const categories = rawChecklist.categories.map(
      (rawCategory, categoryIndex) => {
        const categoryPath = `${path}.categories[${categoryIndex}]`;

        if (!isRecord(rawCategory)) {
          fail(categoryPath, "объект");
        }

        const categoryId = readId(rawCategory.id, `${categoryPath}.id`);
        assertUnique(categoryIds, categoryId, `${categoryPath}.id`);
        const categoryTitle = readString(
          rawCategory.title,
          `${categoryPath}.title`,
        );

        if (!Array.isArray(rawCategory.items)) {
          fail(`${categoryPath}.items`, "массив");
        }

        const itemIds = new Set<string>();
        const items = rawCategory.items.map((rawItem, itemIndex) => {
          const itemPath = `${categoryPath}.items[${itemIndex}]`;

          if (!isRecord(rawItem)) {
            fail(itemPath, "объект");
          }

          const itemId = readId(rawItem.id, `${itemPath}.id`);
          assertUnique(itemIds, itemId, `${itemPath}.id`);

          return {
            id: itemId,
            title: readString(rawItem.title, `${itemPath}.title`),
            checked: readBoolean(rawItem.checked, `${itemPath}.checked`),
          };
        });

        return { id: categoryId, title: categoryTitle, items };
      },
    );

    return { id, title, categories };
  });

  return { checklists };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, "строка");
  }

  return value;
}

function readId(value: unknown, path: string): string {
  const id = readString(value, path);

  if (id.trim() === "") {
    fail(path, "непустая строка");
  }

  return id;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, "boolean");
  }

  return value;
}

function assertUnique(ids: Set<string>, id: string, path: string): void {
  if (ids.has(id)) {
    fail(path, "уникальный id");
  }

  ids.add(id);
}

function fail(path: string, expected: string): never {
  throw new DataError(`Некорректные данные: ${path} — ожидается ${expected}`);
}
