export default function BlopSpeech({ text }: { text: string }) {
  return (
    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 bg-purple-900 border border-purple-600 rounded-xl px-3 py-2 text-xs text-purple-100 text-center shadow-lg animate-bounce">
      {text}
      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-900 border-r border-b border-purple-600 rotate-45" />
    </div>
  )
}
