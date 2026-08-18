import Category from '#models/category'

/**
 * Returns categories in tree order: each top-level category followed
 * immediately by its children (each group in sortOrder), so a flat list can be
 * rendered with children nested under their parent (e.g. CategorySelect) and
 * parents never interleave with another parent's children.
 */
export function flattenCategoriesTree(categories: Category[]): Category[] {
  const byParent = new Map<number, Category[]>()
  const topLevel: Category[] = []
  for (const category of categories) {
    if (category.parentId === null) {
      topLevel.push(category)
    } else {
      const siblings = byParent.get(category.parentId)
      if (siblings) siblings.push(category)
      else byParent.set(category.parentId, [category])
    }
  }

  const flat: Category[] = []
  for (const parent of topLevel.sort((a, b) => a.sortOrder - b.sortOrder)) {
    flat.push(parent)
    const children = byParent.get(parent.id)
    if (children) {
      flat.push(...children.sort((a, b) => a.sortOrder - b.sortOrder))
    }
  }
  return flat
}

/**
 * One-level nesting: a category's parent must exist and must itself be a
 * top-level category (never a child). Throws a human-readable error the
 * controller turns into a 422/409. Returns the parent so callers can skip an
 * extra lookup if they need it.
 */
export async function findUsableParent(parentId: number): Promise<Category> {
  const parent = await Category.find(parentId)
  if (!parent) {
    throw new Error('The selected parent category does not exist')
  }
  if (parent.parentId !== null) {
    throw new Error('Only top-level categories can be parents')
  }
  return parent
}

/**
 * A category that already has children cannot be demoted to a child itself -
 * that would create grandchildren (nesting is one level only).
 */
export async function assertNoChildren(category: Category): Promise<void> {
  const row = await Category.query().where('parentId', category.id).count('* as count').first()
  // `count(*)` always returns a row, so `row` is never null and the `?? 0`
  // fallback can't actually fire (see README's documented coverage exclusions).
  if (Number(row?.$extras.count ?? /* c8 ignore next */ 0) > 0) {
    throw new Error('A category with children cannot be moved under another category')
  }
}

/**
 * Archives/unarchives a category together with its children, so a parent never
 * hides while its children stay active (or vice versa). Unarchiving a child
 * also unarchives its parent - otherwise the child stays hidden under an
 * archived parent.
 */
export async function setArchivedRecursively(category: Category, archived: boolean): Promise<void> {
  await Category.query().where('id', category.id).update({ isArchived: archived })
  await Category.query().where('parentId', category.id).update({ isArchived: archived })
  if (category.parentId !== null) {
    await Category.query().where('id', category.parentId).update({ isArchived: archived })
  }
}
