export default function Toast({ msg }) {
  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/90 text-white text-sm px-5 py-2 rounded-full shadow-lg whitespace-nowrap transition-opacity duration-300 ${
        msg ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {msg}
    </div>
  )
}
