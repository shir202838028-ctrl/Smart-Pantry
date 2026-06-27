import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export default function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      <p className="mt-2 max-w-sm text-gray-500">{description}</p>
    </div>
  )
}
