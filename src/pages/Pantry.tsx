import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2, Plus, Refrigerator, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface PantryItem {
  id: number
  ingredient_id: number
  name: string
}

// The joined `ingredients` relation can come back as an object (to-one) or,
// depending on how the FK is detected, an array. Normalise to a single record.
interface PantryRow {
  id: number
  ingredient_id: number
  ingredients: { name: string } | { name: string }[] | null
}

function normaliseRow(row: PantryRow): PantryItem {
  const ingredient = Array.isArray(row.ingredients)
    ? row.ingredients[0]
    : row.ingredients
  return {
    id: row.id,
    ingredient_id: row.ingredient_id,
    name: ingredient?.name ?? 'מצרך לא ידוע',
  }
}

export default function Pantry() {
  const { user } = useAuth()
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [newIngredient, setNewIngredient] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPantry = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('user_pantry')
      .select('id, ingredient_id, ingredients(name)')
      .eq('user_id', user.id)
      .order('id', { ascending: false })

    if (error) {
      console.error('Failed to fetch pantry:', error)
      setError(error.message)
    } else {
      setItems((data as PantryRow[]).map(normaliseRow))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchPantry()
  }, [fetchPantry])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    const name = newIngredient.trim()
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
      // Use the canonical stored name when the ingredient already exists.
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

      // 3. Guard against adding a duplicate to this user's pantry.
      if (items.some((item) => item.ingredient_id === ingredientId)) {
        setError(`"${ingredientName}" כבר נמצא במזווה שלך.`)
        return
      }

      // 4. Link the ingredient to the current user's pantry, returning the new
      //    row so we can update local state without a round-trip refetch.
      const { data: linked, error: linkError } = await supabase
        .from('user_pantry')
        .insert({ user_id: user.id, ingredient_id: ingredientId })
        .select('id, ingredient_id')
        .single()
      if (linkError) {
        console.error('Pantry insert failed:', linkError)
        throw linkError
      }

      // 5. Update React state immediately so the new card appears instantly.
      setItems((prev) => [
        { id: linked.id, ingredient_id: linked.ingredient_id, name: ingredientName },
        ...prev,
      ])
      setNewIngredient('')
      setSuccess(`"${ingredientName}" נוסף למזווה שלך.`)
    } catch (err) {
      console.error('Failed to add ingredient:', err)
      setError(err instanceof Error ? err.message : 'הוספת המצרך נכשלה.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (item: PantryItem) => {
    setRemovingId(item.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('user_pantry')
      .delete()
      .eq('id', item.id)

    if (error) {
      console.error('Failed to remove pantry item:', error)
      setError(error.message)
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setSuccess(`"${item.name}" הוסר מהמזווה שלך.`)
    }
    setRemovingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Refrigerator className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">המזווה שלי</h1>
          <p className="text-sm text-gray-500">
            עקבו אחר המצרכים שיש לכם במלאי.
          </p>
        </div>
      </div>

      {/* Add ingredient form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row"
      >
        <input
          type="text"
          value={newIngredient}
          onChange={(e) => setNewIngredient(e.target.value)}
          placeholder="הוסף מצרך... (לדוגמה: עגבניות)"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={adding || !newIngredient.trim()}
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

      {/* Pantry grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <Refrigerator className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            המזווה שלך ריק. הוסיפו את המצרך הראשון למעלה.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span className="truncate font-medium capitalize text-gray-800">
                {item.name}
              </span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
