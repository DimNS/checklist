#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода ошибок
error() {
    echo -e "${RED}ОШИБКА: $1${NC}" >&2
    exit 1
}

# Функция для вывода успеха
success() {
    echo -e "${GREEN}✓ $1${NC}" >&2
}

# Функция для вывода информации
info() {
    echo -e "${BLUE}ℹ $1${NC}" >&2
}

# Функция для вывода предупреждения
warning() {
    echo -e "${YELLOW}⚠ $1${NC}" >&2
}

# Функция для получения последней версии из тегов
get_last_version() {
    # Ищем все теги, соответствующие формату vX.Y.Z (мажор.минор.патч)
    local last_tag=$(git tag -l | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1)

    if [[ -z "$last_tag" ]]; then
        echo "v0.0.0"
    else
        echo "$last_tag"
    fi
}

# Функция для разбора версии (ожидает формат vX.Y.Z)
parse_version() {
    local version=${1#v}
    IFS='.' read -r major minor patch <<< "$version"
    echo "$major $minor $patch"
}

# Функция для создания тега
create_tag() {
    local full_version=$1

    info "Создание тега $full_version"

    git tag -a "$full_version" -m "Release $full_version" || error "Не удалось создать тег $full_version"
    success "Создан аннотированный тег $full_version"
}

# Функция для проверки чистоты репозитория
check_clean_repo() {
    if [[ -n $(git status -s) ]]; then
        error "Репозиторий не чист. Сначала закоммитьте или stash'ьте изменения."
    fi

    # Проверяем, что мы на main/master ветке
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        warning "Вы на ветке $current_branch, а не main/master"
        read -p "Продолжить? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Функция для пуша тегов
push_tags() {
    info "Отправка тегов в удаленный репозиторий..."
    git push origin --tags -f || error "Не удалось отправить теги"
    success "Теги успешно отправлены"
}

# Основная логика выбора версии
select_version_type() {
    local last_version=$1
    read -p "Текущая версия: $last_version. Выберите тип обновления [1-3]: " choice

    read -r curr_major curr_minor curr_patch <<< "$(parse_version "$last_version")"

    case $choice in
        1)
            # Патч-релиз
            local new_patch=$((curr_patch + 1))
            new_version="v${curr_major}.${curr_minor}.${new_patch}"
            info "Создание ПАТЧ-релиза: $last_version -> $new_version"
            ;;
        2)
            # Минор-релиз
            local new_minor=$((curr_minor + 1))
            new_version="v${curr_major}.${new_minor}.0"
            info "Создание МИНОР-релиза: $last_version -> $new_version"
            ;;
        3)
            # Мажор-релиз
            local new_major=$((curr_major + 1))
            new_version="v${new_major}.0.0"
            info "Создание МАЖОР-релиза: $last_version -> $new_version"
            ;;
        *)
            error "Неверный выбор. Используйте 1, 2 или 3"
            ;;
    esac

    echo "$new_version"
}

# Функция для ручного ввода версии
manual_version() {
    read -p "Введите новую версию в формате vX.Y.Z (например v2.0.0): " new_version

    # Проверка формата
    if [[ ! $new_version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error "Неверный формат версии. Используйте vX.Y.Z"
    fi

    echo "$new_version"
}

# Основная функция
main() {
    local dry_run=false
    for arg in "$@"; do
        case $arg in
            --dry-run)
                dry_run=true
                shift
                ;;
        esac
    done

    echo "====================================="
    echo "   Git Tag Manager - Выпуск версии   "
    echo "====================================="
    if $dry_run; then
        warning "РЕЖИМ DRY-RUN — тег не будет создан"
    fi
    echo

    # Проверка, что мы в git репозитории
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        error "Это не git репозиторий"
    fi

    # Получаем последнюю версию
    last_version=$(get_last_version)
    info "Последняя версия: $last_version"

    # Спрашиваем, хочет ли пользователь указать версию вручную
    echo
    read -p "Указать версию вручную? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        new_version=$(manual_version)
    else
        echo
        echo "1) Патч (x.y.Z -> x.y.Z+1)"
        echo "2) Минор (x.Y.z -> x.Y+1.0)"
        echo "3) Мажор (X.y.z -> X+1.0.0)"
        echo
        new_version=$(select_version_type "$last_version")
    fi

    # Проверяем, не существует ли уже такой тег
    if git rev-parse "$new_version" >/dev/null 2>&1; then
        warning "Тег $new_version уже существует!"
        read -p "Перезаписать? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Проверяем чистоту репозитория
    check_clean_repo

    # Получаем актуальные изменения
    info "Обновление ветки..."
    git pull origin "$(git branch --show-current)" || warning "Не удалось выполнить pull"

    # Подтверждение
    echo
    info "Будет создан тег: $new_version"
    echo
    read -p "Продолжить? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Операция отменена"
        exit 0
    fi

    if $dry_run; then
        info "DRY-RUN: тег не создавался"
    else
        # Создаем тег
        create_tag "$new_version"

        # Отправляем тег
        push_tags
    fi

    # Финальный вывод
    echo
    success "Релиз $new_version успешно выпущен!"
    echo
    info "Актуальные теги:"
    git tag -l | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -5
}

# Запуск
main "$@"
