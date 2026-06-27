import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface ShoppingItem {
  id: number
  ingredient_id: number
  is_purchased: boolean
  name: string
}

// The joined `ingredients` relation can come back as an object (to-one) or an
// array depending on FK detection — normalise to a single record.
interface ShoppingRow {
  id: number
  ingredient_id: number
  is_purchased: boolean
  ingredients: { name: string } | { name: string }[] | null
}

function normaliseRow(row: ShoppingRow): ShoppingItem {
  const ingredient = Array.isArray(row.ingredients)
    ? row.ingredients[0]
    : row.ingredients
  return {
    id: row.id,
    ingredient_id: row.ingredient_id,
    is_purchased: row.is_purchased,
    name: ingredient?.name ?? 'מצרך לא ידוע',
  }
}

export default function ShoppingList() {
  const { user } = useAuth()
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [newItem, setNewItem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('shopping_list')
      .select('id, is_purchased, ingredient_id, ingredients(name)')
      .eq('user_id', user.id)
      .order('id', { ascending: false })

    if (error) {
      console.error('Failed to fetch shopping list:', error)
      setError(error.message)
    } else {
      setItems((data as ShoppingRow[]).map(normaliseRow))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    const name = newItem.trim()
    if (!name) return

    setAdding(true)
    setError(null)
    setSuccess(null)

    try {
      // 1. Look for an existing ingredient (case-insensitive exact match).
      const { data: existing, error: lookupError } = await supabase
        .from('ingredients')
        .select('id, name')
        .ilike('name', name)
        .limit(1)
        .maybeSingle()
      if (lookupError) {
        console.error('Ingredient lookup failed:', lookupError)
        throw lookupError
      }

      let ingredientId: number
      let ingredientName = name

      if (existing) {
        ingredientId = existing.id
        ingredientName = existing.name
      } else {
        // 2. Insert the new ingredient and grab the returning id.
        const { data: inserted, error: insertError } = await supabase
          .from('ingredients')
          .insert({ name })
          .select('id, name')
          .single()
        if (insertError) {
          console.error('Ingredient insert failed:', insertError)
          throw insertError
        }
        ingredientId = inserted.id
        ingredientName = inserted.name
      }

      // 3. Guard against adding a duplicate to this user's shopping list.
      if (items.some((item) => item.ingredient_id === ingredientId)) {
        setError(`"${ingredientName}" כבר נמצא ברשימת הקניות שלך.`)
        return
      }

      // 4. Add to the shopping list, returning the row for instant UI update.
      const { data: linked, error: linkError } = await supabase
        .from('shopping_list')
        .insert({
          user_id: user.id,
          ingredient_id: ingredientId,
          is_purchased: false,
        })
        .select('id, ingredient_id, is_purchased')
        .single()
      if (linkError) {
        console.error('Shopping list insert failed:', linkError)
        throw linkError
      }

      setItems((prev) => [
        {
          id: linked.id,
          ingredient_id: linked.ingredient_id,
          is_purchased: linked.is_purchased,
          name: ingredientName,
        },
        ...prev,
      ])
      setNewItem('')
      setSuccess(`"${ingredientName}" נוסף לרשימת הקניות שלך.`)
    } catch (err) {
      console.error('Failed to add shopping list item:', err)
      setError(err instanceof Error ? err.message : 'הוספת הפריט נכשלה.')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (item: ShoppingItem) => {
    if (!user) return
    setTogglingId(item.id)
    setError(null)
    setSuccess(null)

    const nextStatus = !item.is_purchased

    // Optimistically update, revert on failure.
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_purchased: nextStatus } : i,
      ),
    )

    const { error } = await supabase
      .from('shopping_list')
      .update({ is_purchased: nextStatus })
      .eq('id', item.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to update item:', error)
      setError(error.message)
      // Revert the optimistic change.
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_purchased: item.is_purchased } : i,
        ),
      )
    }
    setTogglingId(null)
  }

  const handleRemove = async (item: ShoppingItem) => {
    if (!user) return
    setRemovingId(item.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', item.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to remove item:', error)
      setError(error.message)
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setSuccess(`"${item.name}" הוסר מרשימת הקניות שלך.`)
    }
    setRemovingId(null)
  }

  const handleClearPurchased = async () => {
    if (!user) return
    setClearing(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('user_id', user.id)
      .eq('is_purchased', true)

    if (error) {
      console.error('Failed to clear purchased items:', error)
      setError(error.message)
    } else {
      setItems((prev) => prev.filter((i) => !i.is_purchased))
      setSuccess('הפריטים הקנויים נוקו.')
    }
    setClearing(false)
  }

  const purchasedCount = items.filter((i) => i.is_purchased).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">רשימת קניות</h1>
            <p className="text-sm text-gray-500">
              כל מה שצריך לקנות בקנייה הבאה שלכם.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearPurchased}
          disabled={clearing || purchasedCount === 0}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          נקה קנויים
          {purchasedCount > 0 && ` (${purchasedCount})`}
        </button>
      </div>

      {/* Add item form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row"
      >
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="הוסף לרשימה... (לדוגמה: שמן זית)"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={adding || !newItem.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adding ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
          הוסף
        </button>
      </form>

      {/* Messages */}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {success}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <ShoppingCart className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            רשימת הקניות שלך ריקה. הוסיפו פריט למעלה.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50"
            >
              {/* Toggle checkbox */}
              <button
                type="button"
                onClick={() => handleToggle(item)}
                disabled={togglingId === item.id}
                aria-pressed={item.is_purchased}
                aria-label={
                  item.is_purchased ? 'סמן כלא נקנה' : 'סמן כנקנה'
                }
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition ${
                  item.is_purchased
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-white text-transparent hover:border-emerald-400'
                } disabled:opacity-60`}
              >
                {togglingId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>

              {/* Name */}
              <span
                className={`flex-1 truncate capitalize transition ${
                  item.is_purchased
                    ? 'text-gray-400 line-through'
                    : 'text-gray-800'
                }`}
              >
                {item.name}
              </span>

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                disabled={removingId === item.id}
                aria-label={`הסר ${item.name}`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingId === item.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
