import {
  type Category,
  type Checklist,
  type Data,
  type Item,
  loadData,
  parseData,
  type StorageLike,
  saveData,
  serializeData,
} from "./storage";

export interface Stats {
  total: number;
  checked: number;
  remaining: number;
  percent: number;
}

export interface CategoryView {
  id: string;
  title: string;
  items: Item[];
  stats: Stats;
}

export interface ChecklistView {
  id: string;
  title: string;
  categories: CategoryView[];
  stats: Stats;
}

const collator = new Intl.Collator("ru");

export function getStats(checklist: Checklist): Stats {
  return countStats(checklist.categories.flatMap((category) => category.items));
}

export function getChecklistView(checklist: Checklist): ChecklistView {
  const categories = checklist.categories
    .map((category) => ({
      id: category.id,
      title: category.title,
      items: [...category.items].sort(compareItems),
      stats: countStats(category.items),
    }))
    .sort(compareCategories);

  return {
    id: checklist.id,
    title: checklist.title,
    categories,
    stats: getStats(checklist),
  };
}

export class Store {
  private state: Data;

  constructor(private readonly storage: StorageLike) {
    this.state = loadData(storage);
  }

  get data(): Data {
    return this.state;
  }

  getChecklistView(checklistId: string): ChecklistView | null {
    const checklist = this.state.checklists.find(
      (entry) => entry.id === checklistId,
    );

    return checklist ? getChecklistView(checklist) : null;
  }

  createChecklist(title: string): Checklist {
    const checklist: Checklist = {
      id: createId(),
      title: readTitle(title),
      categories: [],
    };

    this.mutate((data) => {
      data.checklists.push(checklist);
    });

    return checklist;
  }

  renameChecklist(checklistId: string, title: string): void {
    const nextTitle = readTitle(title);
    this.mutate((data) => {
      requireChecklist(data, checklistId).title = nextTitle;
    });
  }

  deleteChecklist(checklistId: string): void {
    this.mutate((data) => {
      const index = data.checklists.findIndex(
        (checklist) => checklist.id === checklistId,
      );

      if (index === -1) {
        missing("чеклист", checklistId);
      }

      data.checklists.splice(index, 1);
    });
  }

  createCategory(checklistId: string, title: string): Category {
    const category: Category = {
      id: createId(),
      title: readTitle(title),
      items: [],
    };

    this.mutate((data) => {
      requireChecklist(data, checklistId).categories.push(category);
    });

    return category;
  }

  renameCategory(checklistId: string, categoryId: string, title: string): void {
    const nextTitle = readTitle(title);
    this.mutate((data) => {
      requireCategory(data, checklistId, categoryId).title = nextTitle;
    });
  }

  deleteCategory(checklistId: string, categoryId: string): void {
    this.mutate((data) => {
      const checklist = requireChecklist(data, checklistId);
      const index = checklist.categories.findIndex(
        (category) => category.id === categoryId,
      );

      if (index === -1) {
        missing("категорию", categoryId);
      }

      checklist.categories.splice(index, 1);
    });
  }

  createItem(checklistId: string, categoryId: string, title: string): Item {
    const item: Item = {
      id: createId(),
      title: readTitle(title),
      checked: false,
    };

    this.mutate((data) => {
      requireCategory(data, checklistId, categoryId).items.push(item);
    });

    return item;
  }

  renameItem(
    checklistId: string,
    categoryId: string,
    itemId: string,
    title: string,
  ): void {
    const nextTitle = readTitle(title);
    this.mutate((data) => {
      requireItem(data, checklistId, categoryId, itemId).title = nextTitle;
    });
  }

  deleteItem(checklistId: string, categoryId: string, itemId: string): void {
    this.mutate((data) => {
      const category = requireCategory(data, checklistId, categoryId);
      const index = category.items.findIndex((item) => item.id === itemId);

      if (index === -1) {
        missing("элемент", itemId);
      }

      category.items.splice(index, 1);
    });
  }

  setItemChecked(
    checklistId: string,
    categoryId: string,
    itemId: string,
    checked: boolean,
  ): void {
    this.mutate((data) => {
      requireItem(data, checklistId, categoryId, itemId).checked = checked;
    });
  }

  resetChecked(checklistId: string): void {
    this.mutate((data) => {
      for (const category of requireChecklist(data, checklistId).categories) {
        for (const item of category.items) {
          item.checked = false;
        }
      }
    });
  }

  importData(raw: string): void {
    const data = parseData(raw);
    saveData(this.storage, data);
    this.state = data;
  }

  exportData(): string {
    return serializeData(this.state);
  }

  private mutate(change: (data: Data) => void): void {
    const next = structuredClone(this.state);
    change(next);
    saveData(this.storage, next);
    this.state = next;
  }
}

function countStats(items: Item[]): Stats {
  const total = items.length;
  const checked = items.filter((item) => item.checked).length;

  return {
    total,
    checked,
    remaining: total - checked,
    percent: total === 0 ? 0 : Math.round((checked / total) * 100),
  };
}

function compareItems(a: Item, b: Item): number {
  if (a.checked !== b.checked) {
    return a.checked ? 1 : -1;
  }

  return collator.compare(a.title, b.title);
}

function compareCategories(a: CategoryView, b: CategoryView): number {
  const aDone = a.stats.total > 0 && a.stats.remaining === 0;
  const bDone = b.stats.total > 0 && b.stats.remaining === 0;

  if (aDone !== bDone) {
    return aDone ? 1 : -1;
  }

  return collator.compare(a.title, b.title);
}

function createId(): string {
  return crypto.randomUUID();
}

function readTitle(value: string): string {
  const title = value.trim();

  if (title === "") {
    throw new Error("Название не может быть пустым");
  }

  return title;
}

function requireChecklist(data: Data, checklistId: string): Checklist {
  const checklist = data.checklists.find((entry) => entry.id === checklistId);

  if (!checklist) {
    missing("чеклист", checklistId);
  }

  return checklist;
}

function requireCategory(
  data: Data,
  checklistId: string,
  categoryId: string,
): Category {
  const category = requireChecklist(data, checklistId).categories.find(
    (entry) => entry.id === categoryId,
  );

  if (!category) {
    missing("категорию", categoryId);
  }

  return category;
}

function requireItem(
  data: Data,
  checklistId: string,
  categoryId: string,
  itemId: string,
): Item {
  const item = requireCategory(data, checklistId, categoryId).items.find(
    (entry) => entry.id === itemId,
  );

  if (!item) {
    missing("элемент", itemId);
  }

  return item;
}

function missing(kind: string, id: string): never {
  throw new Error(`Не удалось найти ${kind} с id ${id}`);
}
