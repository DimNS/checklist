export type Child = Node | string | number | false | null | undefined;

type Attributes = Record<string, string | number | boolean | null | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (name === "class") {
      node.className = String(value);
    } else {
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }

    node.append(child instanceof Node ? child : String(child));
  }

  return node;
}

export function editForm(options: {
  value: string;
  form: string;
  data?: Record<string, string>;
}): HTMLFormElement {
  const attributes: Attributes = {
    class: "inline-form edit-form",
    "data-form": options.form,
  };

  for (const [key, value] of Object.entries(options.data ?? {})) {
    attributes[`data-${key}`] = value;
  }

  return el(
    "form",
    attributes,
    el("input", {
      name: "title",
      value: options.value,
      required: true,
      autocomplete: "off",
      autofocus: true,
      "aria-label": "Новое название",
    }),
    el("button", { type: "submit" }, "Сохранить"),
    el("button", { type: "button", "data-action": "cancel-edit" }, "Отмена"),
  );
}
