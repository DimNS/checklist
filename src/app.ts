import { editForm, el } from "./dom";
import { checklistHash, parseHash } from "./router";
import {
  type Checklist,
  clearData,
  type Item,
  type StorageLike,
} from "./storage";
import { type CategoryView, getStats, type Stats, Store } from "./store";

type EditTarget =
  | { kind: "checklist"; id: string }
  | { kind: "category"; checklistId: string; id: string }
  | { kind: "item"; checklistId: string; categoryId: string; id: string };

export class App {
  private store: Store | null = null;
  private loadError: string | null = null;
  private notice: string | null = null;
  private edit: EditTarget | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly storage: StorageLike,
  ) {
    this.load();
    root.addEventListener("click", this.onClick);
    root.addEventListener("submit", this.onSubmit);
    root.addEventListener("change", this.onChange);
    window.addEventListener("hashchange", this.onHashChange);
    this.render();
  }

  render(): void {
    const route = parseHash(location.hash);
    let screen: HTMLElement;

    if (!this.store) {
      screen = this.renderError();
    } else if (route.name === "checklist") {
      screen = this.renderChecklistScreen(route.id);
    } else {
      screen = this.renderHome();
    }

    this.root.replaceChildren(screen);

    const input = this.root.querySelector<HTMLInputElement>("input[autofocus]");
    input?.focus();
    input?.select();
  }

  private load(): void {
    try {
      this.store = new Store(this.storage);
      this.loadError = null;
    } catch (error) {
      this.store = null;
      this.loadError = message(error);
    }
  }

  private readonly onHashChange = (): void => {
    this.edit = null;
    this.notice = null;
    this.render();
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest<HTMLButtonElement>(
      "button[data-action]",
    );

    if (!button) {
      return;
    }

    const { action, id, checklistId, categoryId } = button.dataset;

    try {
      switch (action) {
        case "edit-checklist":
          if (!id) {
            return;
          }
          this.edit = { kind: "checklist", id };
          break;
        case "edit-category":
          if (!checklistId || !id) {
            return;
          }
          this.edit = { kind: "category", checklistId, id };
          break;
        case "edit-item":
          if (!checklistId || !categoryId || !id) {
            return;
          }
          this.edit = { kind: "item", checklistId, categoryId, id };
          break;
        case "delete-checklist":
          if (!id || !confirm("Удалить чеклист?")) {
            return;
          }
          this.requireStore().deleteChecklist(id);
          this.edit = null;
          break;
        case "delete-category":
          if (
            !checklistId ||
            !id ||
            !confirm("Удалить категорию вместе с пунктами?")
          ) {
            return;
          }
          this.requireStore().deleteCategory(checklistId, id);
          this.edit = null;
          break;
        case "delete-item":
          if (
            !checklistId ||
            !categoryId ||
            !id ||
            !confirm("Удалить пункт?")
          ) {
            return;
          }
          this.requireStore().deleteItem(checklistId, categoryId, id);
          this.edit = null;
          break;
        case "reset-checked":
          if (!id || !confirm("Сбросить все отметки в этом чеклисте?")) {
            return;
          }
          this.requireStore().resetChecked(id);
          break;
        case "cancel-edit":
          this.edit = null;
          break;
        case "export":
          this.exportData();
          return;
        case "reset-storage":
          if (!confirm("Удалить повреждённые данные без восстановления?")) {
            return;
          }
          clearData(this.storage);
          this.load();
          this.edit = null;
          location.hash = "#/";
          break;
        default:
          return;
      }

      this.notice = null;
      this.render();
    } catch (error) {
      this.fail(error);
    }
  };

  private readonly onSubmit = (event: SubmitEvent): void => {
    if (!(event.target instanceof HTMLFormElement)) {
      return;
    }

    const form = event.target;
    const action = form.dataset.form;

    if (!action) {
      return;
    }

    event.preventDefault();

    const title = String(new FormData(form).get("title") ?? "");
    const { id, checklistId, categoryId } = form.dataset;
    const store = this.requireStore();

    try {
      switch (action) {
        case "create-checklist":
          store.createChecklist(title);
          break;
        case "rename-checklist":
          if (!id) {
            return;
          }
          store.renameChecklist(id, title);
          break;
        case "create-category":
          if (!checklistId) {
            return;
          }
          store.createCategory(checklistId, title);
          break;
        case "rename-category":
          if (!checklistId || !id) {
            return;
          }
          store.renameCategory(checklistId, id, title);
          break;
        case "create-item":
          if (!checklistId || !categoryId) {
            return;
          }
          store.createItem(checklistId, categoryId, title);
          break;
        case "rename-item":
          if (!checklistId || !categoryId || !id) {
            return;
          }
          store.renameItem(checklistId, categoryId, id, title);
          break;
        default:
          return;
      }

      this.edit = null;
      this.notice = null;
      this.render();
    } catch (error) {
      this.fail(error);
    }
  };

  private readonly onChange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const input = event.target;
    const { action, id, checklistId, categoryId } = input.dataset;

    if (action === "toggle-item") {
      if (!checklistId || !categoryId || !id) {
        return;
      }

      try {
        this.requireStore().setItemChecked(
          checklistId,
          categoryId,
          id,
          input.checked,
        );
        this.notice = null;
        this.render();
      } catch (error) {
        this.fail(error);
      }

      return;
    }

    if (action === "import") {
      void this.importData(input);
    }
  };

  private async importData(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      this.requireStore().importData(await file.text());
      this.edit = null;
      this.notice = null;
      this.render();
    } catch (error) {
      this.fail(error);
    }
  }

  private exportData(): void {
    const blob = new Blob([this.requireStore().exportData()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const link = el("a", { href: url, download: `checklists_${stamp}.json` });

    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private requireStore(): Store {
    if (!this.store) {
      throw new Error("Данные не загружены");
    }

    return this.store;
  }

  private fail(error: unknown): void {
    if (this.store) {
      this.notice = message(error);
    } else {
      this.loadError = message(error);
    }

    this.render();
  }

  private renderHome(): HTMLElement {
    const cards = this.requireStore().data.checklists.map((checklist) =>
      this.renderChecklistCard(checklist),
    );

    return el(
      "main",
      { class: "screen" },
      el("header", { class: "screen-header" }, el("h1", {}, "Чеклисты")),
      this.renderNotice(),
      el(
        "form",
        { class: "inline-form", "data-form": "create-checklist" },
        el("input", {
          name: "title",
          placeholder: "Новый чеклист",
          "aria-label": "Название чеклиста",
          autocomplete: "off",
          required: true,
        }),
        el("button", { type: "submit" }, "Создать"),
      ),
      el(
        "div",
        { class: "toolbar" },
        el("button", { type: "button", "data-action": "export" }, "Экспорт"),
        el(
          "label",
          { class: "file-button" },
          "Импорт",
          el("input", {
            type: "file",
            accept: ".json,application/json",
            "data-action": "import",
          }),
        ),
      ),
      cards.length === 0
        ? el("p", { class: "empty" }, "Пока нет чеклистов.")
        : el("ul", { class: "cards" }, ...cards),
    );
  }

  private renderChecklistCard(checklist: Checklist): HTMLElement {
    const stats = getStats(checklist);

    if (this.isEditingChecklist(checklist.id)) {
      return el(
        "li",
        { class: "card" },
        editForm({
          value: checklist.title,
          form: "rename-checklist",
          data: { id: checklist.id },
        }),
      );
    }

    return el(
      "li",
      { class: "card" },
      el(
        "div",
        { class: "card-head" },
        el(
          "a",
          { class: "card-title", href: checklistHash(checklist.id) },
          checklist.title,
        ),
        el("span", { class: "muted" }, `${stats.checked}/${stats.total}`),
        el(
          "div",
          { class: "actions" },
          el(
            "button",
            {
              type: "button",
              "data-action": "edit-checklist",
              "data-id": checklist.id,
            },
            "Переименовать",
          ),
          el(
            "button",
            {
              type: "button",
              class: "danger",
              "data-action": "delete-checklist",
              "data-id": checklist.id,
            },
            "Удалить",
          ),
        ),
      ),
    );
  }

  private renderChecklistScreen(checklistId: string): HTMLElement {
    const view = this.requireStore().getChecklistView(checklistId);

    if (!view) {
      return this.renderNotFound();
    }

    return el(
      "main",
      { class: "screen" },
      el(
        "nav",
        { class: "breadcrumb" },
        el("a", { href: "#/" }, "← Все чеклисты"),
      ),
      el(
        "header",
        { class: "screen-header" },
        el("h1", {}, view.title),
        el("p", { class: "stats" }, statsText(view.stats)),
      ),
      progressBar(view.stats),
      el(
        "div",
        { class: "toolbar" },
        el(
          "button",
          {
            type: "button",
            "data-action": "reset-checked",
            "data-id": checklistId,
            disabled: view.stats.checked === 0,
          },
          "Сбросить отметки",
        ),
      ),
      this.renderNotice(),
      el(
        "form",
        {
          class: "inline-form",
          "data-form": "create-category",
          "data-checklist-id": checklistId,
        },
        el("input", {
          name: "title",
          placeholder: "Новая категория",
          "aria-label": "Название категории",
          autocomplete: "off",
          required: true,
        }),
        el("button", { type: "submit" }, "Добавить категорию"),
      ),
      view.categories.length === 0
        ? el("p", { class: "empty" }, "Пока нет категорий.")
        : el(
            "ul",
            { class: "cards" },
            ...view.categories.map((category) =>
              this.renderCategory(checklistId, category),
            ),
          ),
    );
  }

  private renderCategory(
    checklistId: string,
    category: CategoryView,
  ): HTMLElement {
    const items = category.items.map((item) =>
      this.renderItem(checklistId, category.id, item),
    );

    return el(
      "li",
      { class: "card" },
      this.isEditingCategory(checklistId, category.id)
        ? editForm({
            value: category.title,
            form: "rename-category",
            data: { id: category.id, "checklist-id": checklistId },
          })
        : el(
            "div",
            { class: "card-head" },
            el("h2", {}, category.title),
            el(
              "span",
              { class: "muted" },
              `${category.stats.checked}/${category.stats.total}`,
            ),
            el(
              "div",
              { class: "actions" },
              el(
                "button",
                {
                  type: "button",
                  "data-action": "edit-category",
                  "data-id": category.id,
                  "data-checklist-id": checklistId,
                },
                "Переименовать",
              ),
              el(
                "button",
                {
                  type: "button",
                  class: "danger",
                  "data-action": "delete-category",
                  "data-id": category.id,
                  "data-checklist-id": checklistId,
                },
                "Удалить",
              ),
            ),
          ),
      items.length === 0
        ? el("p", { class: "empty" }, "Нет пунктов.")
        : el("ul", { class: "items" }, ...items),
      el(
        "form",
        {
          class: "inline-form",
          "data-form": "create-item",
          "data-checklist-id": checklistId,
          "data-category-id": category.id,
        },
        el("input", {
          name: "title",
          placeholder: "Новый пункт",
          "aria-label": "Новый пункт",
          autocomplete: "off",
          required: true,
        }),
        el("button", { type: "submit" }, "Добавить"),
      ),
    );
  }

  private renderItem(
    checklistId: string,
    categoryId: string,
    item: Item,
  ): HTMLElement {
    if (this.isEditingItem(checklistId, categoryId, item.id)) {
      return el(
        "li",
        { class: "item" },
        editForm({
          value: item.title,
          form: "rename-item",
          data: {
            id: item.id,
            "checklist-id": checklistId,
            "category-id": categoryId,
          },
        }),
      );
    }

    return el(
      "li",
      { class: item.checked ? "item done" : "item" },
      el(
        "label",
        { class: "item-label" },
        el("input", {
          type: "checkbox",
          checked: item.checked,
          "data-action": "toggle-item",
          "data-id": item.id,
          "data-checklist-id": checklistId,
          "data-category-id": categoryId,
        }),
        el("span", { class: "item-title" }, item.title),
      ),
      el(
        "div",
        { class: "actions" },
        el(
          "button",
          {
            type: "button",
            "data-action": "edit-item",
            "data-id": item.id,
            "data-checklist-id": checklistId,
            "data-category-id": categoryId,
          },
          "Переименовать",
        ),
        el(
          "button",
          {
            type: "button",
            class: "danger",
            "data-action": "delete-item",
            "data-id": item.id,
            "data-checklist-id": checklistId,
            "data-category-id": categoryId,
          },
          "Удалить",
        ),
      ),
    );
  }

  private renderError(): HTMLElement {
    return el(
      "main",
      { class: "screen" },
      el("header", { class: "screen-header" }, el("h1", {}, "Ошибка данных")),
      el(
        "p",
        { class: "notice", role: "alert" },
        this.loadError ?? "Не удалось загрузить данные.",
      ),
      el(
        "p",
        {},
        "Сохранённые данные повреждены. Их можно удалить и начать заново.",
      ),
      el(
        "button",
        { type: "button", class: "danger", "data-action": "reset-storage" },
        "Сбросить повреждённые данные",
      ),
    );
  }

  private renderNotFound(): HTMLElement {
    return el(
      "main",
      { class: "screen" },
      el(
        "nav",
        { class: "breadcrumb" },
        el("a", { href: "#/" }, "← Все чеклисты"),
      ),
      el("h1", {}, "Чеклист не найден"),
      el("p", { class: "muted" }, "Возможно, он был удалён."),
    );
  }

  private renderNotice(): HTMLElement | null {
    return this.notice
      ? el("p", { class: "notice", role: "alert" }, this.notice)
      : null;
  }

  private isEditingChecklist(id: string): boolean {
    return this.edit?.kind === "checklist" && this.edit.id === id;
  }

  private isEditingCategory(checklistId: string, id: string): boolean {
    return (
      this.edit?.kind === "category" &&
      this.edit.checklistId === checklistId &&
      this.edit.id === id
    );
  }

  private isEditingItem(
    checklistId: string,
    categoryId: string,
    id: string,
  ): boolean {
    return (
      this.edit?.kind === "item" &&
      this.edit.checklistId === checklistId &&
      this.edit.categoryId === categoryId &&
      this.edit.id === id
    );
  }
}

function statsText(stats: Stats): string {
  return `Выполнено ${stats.checked} из ${stats.total} · ${stats.percent}%`;
}

function progressBar(stats: Stats): HTMLElement {
  return el(
    "div",
    {
      class: "progress",
      role: "progressbar",
      "aria-label": "Прогресс чеклиста",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": stats.percent,
    },
    el("div", { class: "progress-fill", style: `width: ${stats.percent}%` }),
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
