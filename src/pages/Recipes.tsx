import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ChefHat,
  Loader2,
  Plus,
  ShoppingCart,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Recipe {
  id: number
  title: string
}

interface Ingredient {
  id: number
  name: string
}

export default function Recipes() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [addingToListId, setAddingToListId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Ingredient picker state.
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [newIngredientName, setNewIngredientName] = useState('')
  const [addingIngredient, setAddingIngredient] = useState(false)

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title')
      .order('id', { ascending: false })

    if (error) {
      console.error('Failed to fetch recipes:', error)
      setError(error.message)
    } else {
      setRecipes(data as Recipe[])
    }
    setLoading(false)
  }, [])

  const fetchIngredients = useCallback(async () => {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to fetch ingredients:', error)
      setFormError(error.message)
    } else {
      setIngredients(data as Ingredient[])
    }
  }, [])

  useEffect(() => {
    fetchRecipes()
    fetchIngredients()
  }, [fetchRecipes, fetchIngredients])

  const openModal = () => {
    setNewTitle('')
    setSelectedIds(new Set())
    setNewIngredientName('')
    setFormError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return
    setShowModal(false)
  }

  const toggleIngredient = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Create a brand-new ingredient on the fly and select it. If it already
  // exists (case-insensitive), just select the existing one.
  const handleAddIngredient = async () => {
    const name = newIngredientName.trim()
    if (!name) return

    setFormError(null)

    const existing = ingredients.find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    )
    if (existing) {
      setSelectedIds((prev) => new Set(prev).add(existing.id))
      setNewIngredientName('')
      return
    }

    setAddingIngredient(true)
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('ingredients')
        .insert({ name })
        .select('id, name')
        .single()
      if (insertError) throw insertError

      const ingredient = inserted as Ingredient
      setIngredients((prev) =>
        [...prev, ingredient].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSelectedIds((prev) => new Set(prev).add(ingredient.id))
      setNewIngredientName('')
    } catch (err) {
      console.error('Failed to add ingredient:', err)
      const message = err instanceof Error ? err.message : 'שגיאה לא צפויה.'
      setFormError(`הוספת המצרך נכשלה: ${message}`)
    } finally {
      setAddingIngredient(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      // 1. Insert the recipe and get its id.
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({ title })
        .select('id, title')
        .single()
      if (recipeError) throw recipeError

      // 2. Link the selected ingredients via recipe_ingredients.
      const ingredientIds = Array.from(selectedIds)
      if (ingredientIds.length > 0) {
        const { error: linkError } = await supabase
          .from('recipe_ingredients')
          .insert(
            ingredientIds.map((ingredient_id) => ({
              recipe_id: (recipe as Recipe).id,
              ingredient_id,
            })),
          )
        if (linkError) throw linkError
      }

      setRecipes((prev) => [recipe as Recipe, ...prev])
      setNotice(
        `המתכון "${title}" נשמר עם ${ingredientIds.length} מצרכים.`,
      )
      setShowModal(false)
    } catch (err) {
      console.error('Failed to create recipe:', err)
      const message = err instanceof Error ? err.message : 'שגיאה לא צפויה.'
      setFormError(`שמירת המתכון נכשלה: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  // Add every ingredient of a recipe to the current user's shopping list,
  // skipping ones already on the list to avoid duplicates.
  const handleAddToShoppingList = async (recipeId: number) => {
    if (!user) {
      setError('יש להתחבר כדי להוסיף לרשימת הקניות.')
      return
    }

    setAddingToListId(recipeId)
    setError(null)
    setNotice(null)

    try {
      // 1. Get the ingredient ids linked to this recipe.
      const { data: links, error: linksError } = await supabase
        .from('recipe_ingredients')
        .select('ingredient_id')
        .eq('recipe_id', recipeId)
      if (linksError) throw linksError

      const ingredientIds = Array.from(
        new Set((links ?? []).map((l) => l.ingredient_id as number)),
      )
      if (ingredientIds.length === 0) {
        setNotice('למתכון זה אין מצרכים להוספה.')
        return
      }

      // 2. Skip ingredients already on this user's shopping list.
      const { data: existing, error: existingError } = await supabase
        .from('shopping_list')
        .select('ingredient_id')
        .eq('user_id', user.id)
        .in('ingredient_id', ingredientIds)
      if (existingError) throw existingError

      const alreadyListed = new Set(
        (existing ?? []).map((row) => row.ingredient_id as number),
      )
      const toInsert = ingredientIds.filter((id) => !alreadyListed.has(id))

      // 3. Insert the remaining ingredients for the current user.
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('shopping_list')
          .insert(
            toInsert.map((ingredient_id) => ({
              user_id: user.id,
              ingredient_id,
              is_purchased: false,
            })),
          )
        if (insertError) throw insertError
      }

      alert('המצרכים נוספו לרשימת הקניות בהצלחה!')
    } catch (err) {
      console.error('Failed to add recipe to shopping list:', err)
      const message = err instanceof Error ? err.message : 'שגיאה לא צפויה.'
      setError(`הוספת המצרכים לרשימת הקניות נכשלה: ${message}`)
    } finally {
      setAddingToListId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ChefHat className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">מתכונים</h1>
            <p className="text-sm text-gray-500">
              גלו ונהלו את אוסף המתכונים שלכם.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-300"
        >
          <Plus className="h-5 w-5" />
          הוסף מתכון חדש
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <ChefHat className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            אין מתכונים עדיין. הוסיפו את המתכון הראשון כדי להתחיל.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <ChefHat className="h-5 w-5" />
                </span>
                <h2 className="font-semibold capitalize text-gray-800">
                  {recipe.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleAddToShoppingList(recipe.id)}
                disabled={addingToListId === recipe.id}
                className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingToListId === recipe.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                הוסף לרשימת קניות
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Recipe modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">מתכון חדש</h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="סגור"
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="flex min-h-0 flex-1 flex-col space-y-4"
            >
              <div>
                <label
                  htmlFor="recipe-title"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  שם המתכון
                </label>
                <input
                  id="recipe-title"
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="לדוגמה: ספגטי בולונז"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  מצרכים
                  {selectedIds.size > 0 && (
                    <span className="mr-1 text-emerald-600">
                      ({selectedIds.size} נבחרו)
                    </span>
                  )}
                </span>

                {/* Add a new ingredient on the fly */}
                <div className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddIngredient()
                      }
                    }}
                    placeholder="מצרך חדש... (לדוגמה: בצל)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    disabled={addingIngredient || !newIngredientName.trim()}
                    className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addingIngredient ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    הוסף מצרך
                  </button>
                </div>

                {/* Existing ingredients checklist */}
                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
                  {ingredients.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-gray-400">
                      אין מצרכים עדיין. הוסיפו מצרך חדש למעלה.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {ingredients.map((ingredient) => (
                        <li key={ingredient.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(ingredient.id)}
                              onChange={() => toggleIngredient(ingredient.id)}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="flex-1 truncate capitalize text-sm text-gray-800">
                              {ingredient.name}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTitle.trim()}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'שומר...' : 'שמור מתכון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
